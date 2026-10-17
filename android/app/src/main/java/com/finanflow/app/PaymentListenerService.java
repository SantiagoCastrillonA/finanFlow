package com.finanflow.app;

import android.app.Notification;
import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import org.json.JSONObject;

/**
 * Escucha las notificaciones de Google Wallet, Nu, Rappi, Davivienda y Nequi (el usuario lo autoriza en
 * "Acceso a notificaciones"). Todo lo demás se ignora sin leerlo, y nada se registra en logs.
 */
public class PaymentListenerService extends NotificationListenerService {

    /** Si Android tiene conectado el lector en este proceso (el permiso solo dice que está autorizado). */
    static volatile boolean connected;

    @Override
    public void onListenerConnected() {
        connected = true;
        PaymentStore.noteDiag(getApplicationContext(), "connectedAt", System.currentTimeMillis());
    }

    @Override
    public void onListenerDisconnected() {
        connected = false;
        PaymentStore.noteDiag(getApplicationContext(), "disconnectedAt", System.currentTimeMillis());
        if (Build.VERSION.SDK_INT >= 24) requestRebind(component(this));
    }

    static ComponentName component(Context c) {
        return new ComponentName(c, PaymentListenerService.class);
    }

    /**
     * Pide a Android que vuelva a conectar el lector. Tras reinstalar la app (p. ej. desde Android
     * Studio) a veces queda desconectado aunque el permiso siga activo, y no llega ningún aviso. Apagar
     * y encender el componente obliga a Android a enlazarlo de nuevo (es lo mismo que hacer el usuario
     * con el interruptor de "Acceso a notificaciones").
     */
    static void rebind(Context c) {
        ComponentName cn = component(c);
        PackageManager pm = c.getPackageManager();
        pm.setComponentEnabledSetting(cn, PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
        pm.setComponentEnabledSetting(cn, PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
        if (Build.VERSION.SDK_INT >= 24) requestRebind(cn);
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            handle(sbn);
        } catch (Exception e) {
            // Un aviso raro no debe tumbar el servicio (y su texto no se escribe en el log).
        }
    }

    private void handle(StatusBarNotification sbn) throws Exception {
        Context c = getApplicationContext();
        if (!PaymentStore.isEnabled(c)) return;
        String pkg = sbn.getPackageName();
        String source = PaymentParser.sourceOf(pkg);
        if (source == null) return;
        Notification n = sbn.getNotification();
        if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        PaymentStore.noteSource(c, pkg, source);
        PaymentStore.noteDiag(c, "seenAt", System.currentTimeMillis());
        PaymentStore.noteDiag(c, "seenSource", source);

        Bundle extras = n.extras;
        CharSequence title = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence text = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        if (text == null) text = extras.getCharSequence(Notification.EXTRA_TEXT);
        String ownName = PaymentStore.context(c).optString("ownName", "");
        PaymentParser.Result r = PaymentParser.parse(pkg, str(title), str(text), ownName);
        if (r == null) return;

        JSONObject shown = PaymentStore.add(c, PaymentStore.toItem(c, r, sbn.getPostTime()));
        if (shown == null) return; // la misma app repitió el aviso de un pago ya mostrado
        PaymentStore.noteDiag(c, "payAt", System.currentTimeMillis());
        PaymentInboxPlugin.notifyChanged();
        PaymentNotifier.present(c, shown);
    }

    private static String str(CharSequence s) {
        return s == null ? "" : s.toString();
    }
}
