package com.finanflow.app;

import android.content.Context;
import android.content.SharedPreferences;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Cola local de pagos detectados y lo aprendido (tarjeta → cuenta, comercio → categoría). Todo vive en
 * SharedPreferences del teléfono: el texto de las notificaciones nunca sale de aquí.
 *
 * Un elemento: { id, source, type: expense|income|transfer, amount, merchant, date, time,
 * status: pending|confirmed, cardKey, account, fromKey, from, toKey, to, category }.
 */
public final class PaymentStore {

    static final String PREFS = "finanflow_payments";
    private static final String KEY_QUEUE = "queue";
    private static final String KEY_LINKS = "links";
    private static final String KEY_MERCHANTS = "merchants";
    private static final String KEY_CONTEXT = "context";
    private static final String KEY_SOURCES = "sources";
    static final String KEY_ENABLED = "enabled";
    private static final int MAX_ITEMS = 50;
    private static final long SAME_PAYMENT_MS = 10 * 60 * 1000;

    private PaymentStore() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean isEnabled(Context c) {
        return prefs(c).getBoolean(KEY_ENABLED, false);
    }

    static void setEnabled(Context c, boolean on) {
        prefs(c).edit().putBoolean(KEY_ENABLED, on).apply();
    }

    private static JSONObject obj(Context c, String key) {
        try {
            return new JSONObject(prefs(c).getString(key, "{}"));
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    static synchronized JSONArray queue(Context c) {
        try {
            return new JSONArray(prefs(c).getString(KEY_QUEUE, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static void saveQueue(Context c, JSONArray q) {
        prefs(c).edit().putString(KEY_QUEUE, q.toString()).apply();
    }

    /** Lo que envía la web: cuentas, categorías, formato del dinero y tu nombre. */
    static JSONObject context(Context c) {
        return obj(c, KEY_CONTEXT);
    }

    static void setContext(Context c, String json) {
        prefs(c).edit().putString(KEY_CONTEXT, json).apply();
    }

    static JSONObject sources(Context c) {
        return obj(c, KEY_SOURCES);
    }

    static void noteSource(Context c, String pkg, String source) {
        JSONObject s = sources(c);
        try {
            if (!s.has(pkg)) {
                s.put(pkg, source);
                prefs(c).edit().putString(KEY_SOURCES, s.toString()).apply();
            }
        } catch (JSONException ignored) {}
    }

    static String link(Context c, String key) {
        return key == null ? "" : obj(c, KEY_LINKS).optString(key, "");
    }

    static void setLink(Context c, String key, String account) {
        if (key == null || key.isEmpty() || account == null || account.isEmpty()) return;
        JSONObject links = obj(c, KEY_LINKS);
        try {
            links.put(key, account);
        } catch (JSONException ignored) {}
        prefs(c).edit().putString(KEY_LINKS, links.toString()).apply();
    }

    static void learnMerchant(Context c, String merchant, String category) {
        if (merchant == null || merchant.isEmpty() || category == null || category.isEmpty()) return;
        JSONObject m = obj(c, KEY_MERCHANTS);
        try {
            m.put(PaymentParser.plain(merchant), category);
        } catch (JSONException ignored) {}
        prefs(c).edit().putString(KEY_MERCHANTS, m.toString()).apply();
    }

    private static String categoryFor(Context c, String type, String merchant) {
        if (!"expense".equals(type)) return "Otros";
        String learned = obj(c, KEY_MERCHANTS).optString(PaymentParser.plain(merchant == null ? "" : merchant), "");
        if (!learned.isEmpty()) return learned;
        String guess = PaymentParser.guessCategory(merchant);
        return guess != null ? guess : "Otros";
    }

    /** Convierte lo leído en un elemento de la cola, con las cuentas y la categoría que ya conoce. */
    static JSONObject toItem(Context c, PaymentParser.Result r, long time) throws JSONException {
        JSONObject it = new JSONObject();
        it.put("id", "p" + time + Integer.toHexString((r.source + r.amount + r.merchant).hashCode() & 0xfffff));
        it.put("source", r.source);
        it.put("amount", r.amount);
        it.put("merchant", r.merchant == null ? "" : r.merchant);
        it.put("date", new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(new Date(time)));
        it.put("time", time);
        it.put("status", "pending");
        if ("card_payment".equals(r.type) || ("income".equals(r.type) && r.fromSelf)) {
            // Pago de una tarjeta o dinero que te enviaste: es una transferencia entre tus cuentas.
            it.put("type", "transfer");
            it.put("toKey", r.cardKey);
            it.put("to", link(c, r.cardKey));
            String fromKey = ("card_payment".equals(r.type) ? "Pago de " : "Envío a ") + r.cardKey;
            it.put("fromKey", fromKey);
            it.put("from", link(c, fromKey));
            it.put("category", "Transferencia");
        } else {
            it.put("type", r.type);
            it.put("cardKey", r.cardKey);
            it.put("account", link(c, r.cardKey));
            it.put("category", categoryFor(c, r.type, r.merchant));
        }
        return it;
    }

    /**
     * Agrega un pago a la cola. Si es el mismo pago avisado por dos apps (mismo monto en pocos minutos),
     * lo une con el existente: Wallet pone el nombre del comercio, y un envío visto como gasto en un
     * banco e ingreso en otro se convierte en transferencia. Devuelve el elemento a mostrar, o null.
     */
    static synchronized JSONObject add(Context c, JSONObject item) throws JSONException {
        JSONArray q = queue(c);
        for (int i = 0; i < q.length(); i++) {
            JSONObject old = q.getJSONObject(i);
            if (old.optBoolean("test")) continue; // un pago real nunca se une con uno de prueba
            if (Math.abs(old.getLong("time") - item.getLong("time")) > SAME_PAYMENT_MS) continue;
            if (Math.abs(old.getDouble("amount") - item.getDouble("amount")) >= 1) continue;
            if (old.getString("source").equals(item.getString("source"))) {
                // La misma app repitió el aviso (se actualizan): no es otro pago.
                if (old.optString("merchant").equals(item.optString("merchant"))
                    && Math.abs(old.getLong("time") - item.getLong("time")) < 2 * 60 * 1000) return null;
                continue;
            }
            if (!"pending".equals(old.optString("status"))) return null;
            merge(c, old, item);
            saveQueue(c, q);
            return old;
        }
        q.put(item);
        while (q.length() > MAX_ITEMS) q.remove(0);
        saveQueue(c, q);
        return item;
    }

    private static void merge(Context c, JSONObject old, JSONObject item) throws JSONException {
        String a = old.getString("type");
        String b = item.getString("type");
        if (a.equals("expense") && (b.equals("income") || b.equals("transfer"))) {
            toTransfer(old, old.optString("cardKey"), old.optString("account"), keyIn(item), accountIn(item));
        } else if ((a.equals("income") || a.equals("transfer")) && b.equals("expense")) {
            toTransfer(old, item.optString("cardKey"), item.optString("account"), keyIn(old), accountIn(old));
        } else if ("wallet".equals(item.getString("source"))) {
            old.put("merchant", item.getString("merchant"));
            if ("Otros".equals(old.optString("category"))) old.put("category", item.optString("category"));
        }
        if (old.optString("account").isEmpty() && !item.optString("account").isEmpty()) {
            old.put("account", item.optString("account"));
        }
    }

    private static String keyIn(JSONObject it) {
        return it.has("toKey") ? it.optString("toKey") : it.optString("cardKey");
    }

    private static String accountIn(JSONObject it) {
        return it.has("toKey") ? it.optString("to") : it.optString("account");
    }

    private static void toTransfer(JSONObject it, String fromKey, String from, String toKey, String to) throws JSONException {
        it.put("type", "transfer");
        it.put("fromKey", fromKey);
        it.put("from", from);
        it.put("toKey", toKey);
        it.put("to", to);
        it.put("category", "Transferencia");
        it.remove("cardKey");
        it.remove("account");
    }

    static synchronized JSONObject get(Context c, String id) {
        JSONArray q = queue(c);
        for (int i = 0; i < q.length(); i++) {
            JSONObject it = q.optJSONObject(i);
            if (it != null && id.equals(it.optString("id"))) return it;
        }
        return null;
    }

    static synchronized void put(Context c, JSONObject item) {
        JSONArray q = queue(c);
        for (int i = 0; i < q.length(); i++) {
            JSONObject it = q.optJSONObject(i);
            if (it != null && item.optString("id").equals(it.optString("id"))) {
                try {
                    q.put(i, item);
                } catch (JSONException ignored) {}
                saveQueue(c, q);
                return;
            }
        }
        q.put(item);
        saveQueue(c, q);
    }

    static synchronized void remove(Context c, JSONArray ids) {
        JSONArray q = queue(c);
        JSONArray out = new JSONArray();
        for (int i = 0; i < q.length(); i++) {
            JSONObject it = q.optJSONObject(i);
            if (it == null) continue;
            boolean drop = false;
            for (int j = 0; j < ids.length(); j++) if (it.optString("id").equals(ids.optString(j))) drop = true;
            if (!drop) out.put(it);
        }
        saveQueue(c, out);
    }

    /** Qué falta para poder registrar: la cuenta (o el origen y el destino de una transferencia). */
    static String missingField(JSONObject it) {
        if ("transfer".equals(it.optString("type"))) {
            if (it.optString("to").isEmpty()) return "to";
            if (it.optString("from").isEmpty()) return "from";
            return null;
        }
        return it.optString("account").isEmpty() ? "account" : null;
    }

    static String keyFor(JSONObject it, String field) {
        if ("to".equals(field)) return it.optString("toKey");
        if ("from".equals(field)) return it.optString("fromKey");
        return it.optString("cardKey");
    }

    /** Nombre de una cuenta según lo que envió la web. */
    static String accountName(Context c, String id) {
        JSONArray list = context(c).optJSONArray("accounts");
        if (list != null) {
            for (int i = 0; i < list.length(); i++) {
                JSONObject a = list.optJSONObject(i);
                if (a != null && id.equals(a.optString("id"))) return a.optString("name", id);
            }
        }
        return id;
    }

    static String categoryLabel(Context c, String type, String id) {
        JSONArray list = context(c).optJSONArray("categories");
        if (list != null) {
            for (int i = 0; i < list.length(); i++) {
                JSONObject cat = list.optJSONObject(i);
                if (cat != null && id.equals(cat.optString("id")) && type.equals(cat.optString("type"))) return cat.optString("label", id);
            }
        }
        return "Hogar/Servicios".equals(id) ? "Hogar" : id;
    }

    /** Monto con el formato de la moneda de la app ("$ 42.782"). */
    static String money(Context c, double amount) {
        JSONObject m = context(c).optJSONObject("money");
        String symbol = m != null ? m.optString("symbol", "$") : "$";
        int decimals = m != null ? m.optInt("decimals", 0) : 0;
        String group = m != null ? m.optString("group", ".") : ".";
        String dec = m != null ? m.optString("decimal", ",") : ",";
        boolean symbolAfter = m != null && m.optBoolean("after", false);
        long scale = (long) Math.pow(10, decimals);
        long total = Math.round(Math.abs(amount) * scale);
        String intPart = String.valueOf(total / scale);
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < intPart.length(); i++) {
            if (i > 0 && (intPart.length() - i) % 3 == 0) sb.append(group);
            sb.append(intPart.charAt(i));
        }
        if (decimals > 0) {
            String frac = String.valueOf(total % scale);
            while (frac.length() < decimals) frac = "0" + frac;
            sb.append(dec).append(frac);
        }
        return symbolAfter ? sb + " " + symbol : symbol + " " + sb;
    }

    /** Cuentas a elegir: solo tarjetas para el destino de un pago de tarjeta, sin metas para lo demás. */
    static JSONArray accountsFor(Context c, JSONObject it, String field) {
        JSONArray all = context(c).optJSONArray("accounts");
        JSONArray out = new JSONArray();
        if (all == null) return out;
        boolean cardsOnly = "to".equals(field) && it.optString("toKey").contains("tarjeta");
        for (int i = 0; i < all.length(); i++) {
            JSONObject a = all.optJSONObject(i);
            if (a == null) continue;
            if (cardsOnly && !"card".equals(a.optString("kind"))) continue;
            out.put(a);
        }
        return out.length() > 0 ? out : all;
    }
}
