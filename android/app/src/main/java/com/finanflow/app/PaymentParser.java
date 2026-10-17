package com.finanflow.app;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Lee las notificaciones de pago de Google Wallet y de los bancos. Es Java puro (sin Android) para
 * poder probarlo en el computador con textos reales. Devuelve null si la notificación no es un
 * movimiento de dinero (códigos, rechazos, publicidad…).
 */
public final class PaymentParser {

    public static final class Result {
        public String source;    // wallet | nu | rappi | davivienda | nequi
        public String type;      // expense | income | card_payment
        public double amount;
        public String merchant;  // comercio o persona ("" si no se sabe)
        public String cardKey;   // cómo nombra la notificación la cuenta o tarjeta ("MasterDebit ••1821")
        public boolean fromSelf; // dinero que te enviaste a ti mismo (transferencia entre tus cuentas)

        @Override
        public String toString() {
            return source + " " + type + " " + amount + " [" + merchant + "] <" + cardKey + ">" + (fromSelf ? " self" : "");
        }
    }

    private PaymentParser() {}

    /** App de origen según el paquete de Android, o null si no es una de las que se leen. */
    public static String sourceOf(String pkg) {
        if (pkg == null) return null;
        String p = pkg.toLowerCase(Locale.ROOT);
        if (p.contains("walletnfcrel")) return "wallet";
        if (p.startsWith("com.nu.") || p.contains("nubank")) return "nu";
        if (p.contains("rappi")) return "rappi";
        if (p.contains("davivienda")) return "davivienda";
        if (p.contains("nequi")) return "nequi";
        return null;
    }

    public static String sourceLabel(String source) {
        switch (source) {
            case "wallet": return "Google Wallet";
            case "nu": return "Nu";
            case "rappi": return "Rappi";
            case "davivienda": return "Davivienda";
            case "nequi": return "Nequi";
            default: return source;
        }
    }

    private static final String[] IGNORE = {
        "código", "codigo", "clave", "otp", "rechaz", "declin", "no pudimos", "no fue posible", "fallid",
        "intento", "gana ", "oferta", "descuento", "promo", "beneficio", "cupo disponible", "inicio de sesión",
        "inicio de sesion", "vence", "recuerda"
    };
    private static final String[] CARD_PAYMENT = {
        "pagaste tu tarjeta", "pago a tu tarjeta", "pago de tu tarjeta", "recibimos tu pago", "abono a tu tarjeta"
    };
    private static final String[] INCOME = {
        "recibiste", "te llegó", "te llego", "te enviaron", "te envió", "te envio", "te transfirieron", "abono", "consignaci",
        "reembolso", "devoluci"
    };
    private static final String[] EXPENSE = {
        "compra", "pagaste", "pago ", "enviaste", "transferiste", "retiro", "retiraste", "débito", "debito", "cobro"
    };

    // Monto con marca de moneda ("COP42,782.00", "$189.627,03") o, si no hay, un número con miles ("100.000,00").
    private static final Pattern MONEY_MARKED = Pattern.compile("(?:COP|US\\$|USD|\\$)\\s?([0-9][0-9.,]*[0-9]|[0-9])");
    private static final Pattern MONEY_GROUPED = Pattern.compile("(?<![0-9.,])([0-9]{1,3}(?:[.,][0-9]{3})+(?:[.,][0-9]{1,2})?)(?![0-9])");
    // "COP42,782.00 con MasterDebit ••1821" en cualquier línea del texto (puede traer otras antes o después).
    private static final Pattern WALLET_TEXT = Pattern.compile(
        "(?:^|\\s)(?:[A-Z]{3})?\\s*\\$?\\s*[0-9][0-9.,]*\\s+(?:con|with)\\s+(.+?)\\s*$", Pattern.CASE_INSENSITIVE | Pattern.MULTILINE);
    private static final Pattern LAST4 = Pattern.compile("(?:\\*+|•+|\\.{2,}|terminada en|terminado en|final)\\s*([0-9]{4})", Pattern.CASE_INSENSITIVE);

    public static Result parse(String pkg, String title, String text, String ownName) {
        String source = sourceOf(pkg);
        if (source == null) return null;
        title = title == null ? "" : title.trim();
        text = text == null ? "" : text.trim();
        String all = (title + " · " + text).trim();
        String lower = all.toLowerCase(Locale.ROOT);

        Result r = new Result();
        r.source = source;

        if (source.equals("wallet")) {
            // Título = comercio, texto = "COP42,782.00 con MasterDebit ••1821". Las palabras a ignorar se
            // buscan solo en el texto: el nombre de un comercio puede contener "promo", "clave"… Del título
            // solo cuenta que el pago no haya pasado.
            if (containsAny(title.toLowerCase(Locale.ROOT), "rechaz", "declin", "no se pudo", "no pudimos", "fallid", "failed")) return null;
            String textLower = text.toLowerCase(Locale.ROOT);
            for (String w : IGNORE) if (textLower.contains(w)) return null;
            Matcher m = WALLET_TEXT.matcher(text);
            if (!m.find()) return null;
            Double amount = amountIn(m.group());
            if (amount == null) return null;
            r.amount = amount;
            r.merchant = title;
            r.cardKey = normalizeCard(m.group(1));
            r.type = containsAny(lower, "reembolso", "refund", "devoluci") ? "income" : "expense";
            return r;
        }

        for (String w : IGNORE) if (lower.contains(w)) return null;
        Double amount = amountIn(all);
        if (amount == null || amount <= 0) return null;
        r.amount = amount;

        if (containsAny(lower, CARD_PAYMENT)) {
            r.type = "card_payment";
            r.merchant = "Pago tarjeta " + sourceLabel(source);
            r.cardKey = sourceLabel(source) + " · tarjeta de crédito";
            return r;
        }
        if (containsAny(lower, INCOME)) {
            r.type = "income";
            r.merchant = after(all, " de ");
            int sent = lower.indexOf(" te envi");
            if (r.merchant.isEmpty() && sent > 0) r.merchant = before(all, sent);
            r.fromSelf = sameName(r.merchant, ownName);
        } else if (containsAny(lower, EXPENSE)) {
            r.type = "expense";
            String to = containsAny(lower, "enviaste", "transferiste") ? after(all, " a ") : "";
            r.merchant = !to.isEmpty() ? to : after(all, " en ");
        } else {
            return null;
        }
        r.cardKey = cardKey(source, lower, all);
        return r;
    }

    /** "Nu · cuenta", "Nu · tarjeta de crédito" o "Davivienda ••1234". */
    private static String cardKey(String source, String lower, String all) {
        String label = sourceLabel(source);
        Matcher m = LAST4.matcher(all);
        if (m.find()) return label + " ••" + m.group(1);
        if (source.equals("nu") || source.equals("rappi")) {
            boolean credit = (lower.contains("tarjeta") || lower.contains("card")) && !lower.contains("débito") && !lower.contains("debito");
            return label + (credit ? " · tarjeta de crédito" : " · cuenta");
        }
        return label;
    }

    /** Primer monto de un texto, en número. */
    static Double amountIn(String s) {
        Matcher m = MONEY_MARKED.matcher(s);
        if (m.find()) return toNumber(m.group(1));
        m = MONEY_GROUPED.matcher(s);
        if (m.find()) return toNumber(m.group(1));
        return null;
    }

    /**
     * "42,782.00" y "189.627,03" → el último separador es decimal si le siguen 1 o 2 dígitos; un
     * separador seguido de 3 dígitos es de miles ("100.000").
     */
    static Double toNumber(String raw) {
        String s = raw.trim();
        int lastDot = s.lastIndexOf('.');
        int lastComma = s.lastIndexOf(',');
        int last = Math.max(lastDot, lastComma);
        String intPart = s;
        String dec = "";
        if (last >= 0) {
            int digitsAfter = s.length() - last - 1;
            if (digitsAfter == 1 || digitsAfter == 2) {
                intPart = s.substring(0, last);
                dec = s.substring(last + 1);
            }
        }
        intPart = intPart.replaceAll("[.,]", "");
        if (intPart.isEmpty()) return null;
        try {
            return Double.parseDouble(intPart + (dec.isEmpty() ? "" : "." + dec));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Texto que sigue a `word` hasta el siguiente punto, coma o " con ". */
    private static String after(String s, String word) {
        int i = s.toLowerCase(Locale.ROOT).indexOf(word);
        if (i < 0) return "";
        String rest = s.substring(i + word.length());
        String[] stops = {".", ",", " con ", " desde ", " por ", " · ", "\n"};
        int end = rest.length();
        for (String stop : stops) {
            int j = rest.indexOf(stop);
            // Un punto dentro de un monto ("100.000") no corta el nombre.
            while (j >= 0 && stop.equals(".") && j + 1 < rest.length() && Character.isDigit(rest.charAt(j + 1))) {
                j = rest.indexOf(stop, j + 1);
            }
            if (j >= 0 && j < end) end = j;
        }
        String out = rest.substring(0, end).trim();
        if (out.matches(".*[0-9]{3}.*") && amountIn(out) != null) return ""; // era un monto, no un nombre
        return out.length() > 40 ? out.substring(0, 40).trim() : out;
    }

    /** Lo que va antes de `end`, desde el último separador ("Nequi · JUAN PEREZ te envió" → "JUAN PEREZ"). */
    private static String before(String s, int end) {
        String head = s.substring(0, end);
        int start = Math.max(head.lastIndexOf(" · "), Math.max(head.lastIndexOf(". "), head.lastIndexOf(": ")));
        return head.substring(start < 0 ? 0 : start + 2).trim();
    }

    private static String normalizeCard(String card) {
        return card.replaceAll("[•·.*]{2,}\\s*", "••").replaceAll("\\s+", " ").trim();
    }

    private static boolean containsAny(String s, String... words) {
        for (String w : words) if (s.contains(w)) return true;
        return false;
    }

    /** Compara nombres sin tildes ni mayúsculas; basta con que coincidan las 2 primeras palabras. */
    static boolean sameName(String a, String b) {
        if (a == null || b == null || a.isEmpty() || b.isEmpty()) return false;
        String[] x = plain(a).split(" ");
        String[] y = plain(b).split(" ");
        if (x.length < 2 || y.length < 2) return plain(a).equals(plain(b));
        return x[0].equals(y[0]) && x[1].equals(y[1]);
    }

    static String plain(String s) {
        String n = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return n.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9 ]", " ").replaceAll("\\s+", " ").trim();
    }

    private static final String[][] KNOWN_MERCHANTS = {
        {"Comida", "d1", "ara", "exito", "olimpica", "carulla", "jumbo", "makro", "isimo", "oxxo", "mercado",
            "supermercado", "panaderia", "restaurante", "mcdonald", "kfc", "frisby", "juan valdez", "tostao",
            "starbucks", "crepes", "el corral", "domino", "subway", "burger"},
        {"Transporte", "uber", "didi", "cabify", "indriver", "terpel", "primax", "esso", "biomax", "texaco", "mobil",
            "peaje", "parqueadero", "metro de medellin", "transmilenio", "civica"},
        {"Suscripciones", "netflix", "spotify", "disney", "youtube", "prime video", "hbo", "max ", "apple.com",
            "google play", "icloud", "chatgpt", "openai"},
        {"Salud", "drogueria", "farmatodo", "cruz verde", "locatel", "colsubsidio", "farmacia", "clinica", "eps"},
        {"Hogar/Servicios", "epm", "codensa", "enel", "vanti", "gas natural", "claro", "movistar", "tigo", "etb", "acueducto"},
        {"Compras", "falabella", "alkosto", "ktronix", "homecenter", "zara", "h&m", "amazon", "mercadolibre",
            "mercado libre", "shein", "temu"}
    };

    /** Categoría probable de un comercio conocido (id de categoría base), o null. */
    public static String guessCategory(String merchant) {
        if (merchant == null) return null;
        String m = " " + plain(merchant) + " ";
        for (String[] group : KNOWN_MERCHANTS) {
            for (int i = 1; i < group.length; i++) {
                // Palabras cortas ("d1", "ara") deben coincidir completas; las largas, al inicio de una palabra.
                String k = group[i].trim();
                if (m.contains(" " + k + " ") || (k.length() >= 5 && m.contains(" " + k))) return group[0];
            }
        }
        return null;
    }
}
