package com.finanflow.app;

import android.app.ActivityOptions;
import android.app.KeyguardManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import java.util.Locale;
import org.json.JSONObject;

/** Muestra un pago detectado: la tarjeta flotante si se puede, o una notificación con Registrar / Ignorar. */
final class PaymentNotifier {

    static final String CHANNEL = "finanflow_pagos";
    static final String ACTION_CONFIRM = "com.finanflow.app.PAYMENT_CONFIRM";
    static final String ACTION_IGNORE = "com.finanflow.app.PAYMENT_IGNORE";

    private PaymentNotifier() {}

    /** Ids 500–549: uno por pago (reservados en la app para esto). */
    static int notificationId(String id) {
        return 500 + (id.hashCode() & 0x7fffffff) % 50;
    }

    static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Pagos detectados", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Confirma con un toque los pagos que detecta FinanFlow");
        c.getSystemService(NotificationManager.class).createNotificationChannel(ch);
    }

    static void present(Context c, JSONObject it) {
        if (canShowPrompt(c) && PaymentPromptActivity.show(c, it.optString("id"))) return;
        notify(c, it, true);
    }

    /** La tarjeta flotante necesita el permiso "Mostrar sobre otras apps" y la pantalla desbloqueada. */
    static boolean canShowPrompt(Context c) {
        if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(c)) return false;
        PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
        KeyguardManager km = (KeyguardManager) c.getSystemService(Context.KEYGUARD_SERVICE);
        return pm != null && pm.isInteractive() && (km == null || !km.isKeyguardLocked());
    }

    /** Notificación del pago; `alert` = que suene y aparezca arriba (si no, queda en silencio en la bandeja). */
    static void notify(Context c, JSONObject it, boolean alert) {
        ensureChannel(c);
        String id = it.optString("id");
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_finanflow)
            .setColor(0xFF5E5CE6)
            .setContentTitle(title(c, it))
            .setContentText(detail(c, it))
            .setContentIntent(PendingIntent.getActivity(c, notificationId(id), reviewIntent(c, id), flags()))
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_EVENT)
            .setPriority(alert ? NotificationCompat.PRIORITY_HIGH : NotificationCompat.PRIORITY_LOW)
            .setSilent(!alert);
        if (PaymentStore.missingField(it) == null) {
            b.addAction(0, "Registrar", action(c, ACTION_CONFIRM, id));
        }
        b.addAction(0, "Ignorar", action(c, ACTION_IGNORE, id));
        try {
            NotificationManagerCompat.from(c).notify(notificationId(id), b.build());
        } catch (SecurityException e) {
            // Sin permiso de notificaciones: el pago sigue en "Por confirmar" dentro de la app.
        }
    }

    static void cancel(Context c, String id) {
        NotificationManagerCompat.from(c).cancel(notificationId(id));
    }

    static Intent reviewIntent(Context c, String id) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("finanflow://action/review?id=" + id), c, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return i;
    }

    private static PendingIntent action(Context c, String action, String id) {
        Intent i = new Intent(c, PaymentActionReceiver.class).setAction(action).putExtra("id", id);
        return PendingIntent.getBroadcast(c, (action + id).hashCode(), i, flags());
    }

    private static int flags() {
        return PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
    }

    static String headline(JSONObject it) {
        switch (it.optString("type")) {
            case "income": return "Ingreso detectado";
            case "transfer": return "Transferencia detectada";
            default: return "Pago detectado";
        }
    }

    static String signedAmount(Context c, JSONObject it) {
        String type = it.optString("type");
        String sign = "expense".equals(type) ? "−" : "income".equals(type) ? "+" : "";
        return sign + PaymentStore.money(c, it.optDouble("amount"));
    }

    private static String title(Context c, JSONObject it) {
        return headline(it) + ": " + signedAmount(c, it);
    }

    /** "Tiendas Ara · Comida · MasterDebit ••1821". */
    static String detail(Context c, JSONObject it) {
        StringBuilder sb = new StringBuilder(merchant(it));
        if ("transfer".equals(it.optString("type"))) {
            sb.append(" · ").append(route(c, it));
        } else {
            sb.append(" · ").append(PaymentStore.categoryLabel(c, it.optString("type"), it.optString("category")));
            sb.append(" · ").append(accountOrKey(c, it.optString("account"), it.optString("cardKey")));
        }
        return sb.toString();
    }

    /** "Cuenta Nu → Crédito Nu". */
    static String route(Context c, JSONObject it) {
        return accountOrKey(c, it.optString("from"), "?") + " → " + accountOrKey(c, it.optString("to"), it.optString("toKey"));
    }

    static String accountOrKey(Context c, String account, String key) {
        return account.isEmpty() ? key : PaymentStore.accountName(c, account);
    }

    /** Comercio legible: "TIENDA D1 ARMENIA MONT" → "Tienda D1 Armenia Mont". */
    static String merchant(JSONObject it) {
        String m = it.optString("merchant");
        if (m.isEmpty()) return PaymentParser.sourceLabel(it.optString("source"));
        if (!m.equals(m.toUpperCase(Locale.ROOT))) return m;
        StringBuilder sb = new StringBuilder();
        for (String w : m.split("\\s+")) {
            if (sb.length() > 0) sb.append(' ');
            if (w.length() <= 2 || w.matches(".*[0-9].*")) sb.append(w);
            else sb.append(w.charAt(0)).append(w.substring(1).toLowerCase(Locale.ROOT));
        }
        return sb.toString();
    }

    static ActivityOptions enterAnimation(Context c) {
        return ActivityOptions.makeCustomAnimation(c, R.anim.prompt_in, 0);
    }
}
