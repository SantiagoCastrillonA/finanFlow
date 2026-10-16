package com.finanflow.app;

import android.app.Notification;
import android.content.Context;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import org.json.JSONObject;

/**
 * Escucha las notificaciones de Google Wallet, Nu, Rappi, Davivienda y Nequi (el usuario lo autoriza en
 * "Acceso a notificaciones"). Todo lo demás se ignora sin leerlo, y nada se registra en logs.
 */
public class PaymentListenerService extends NotificationListenerService {

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

        Bundle extras = n.extras;
        CharSequence title = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence text = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        if (text == null) text = extras.getCharSequence(Notification.EXTRA_TEXT);
        String ownName = PaymentStore.context(c).optString("ownName", "");
        PaymentParser.Result r = PaymentParser.parse(pkg, str(title), str(text), ownName);
        if (r == null) return;

        JSONObject shown = PaymentStore.add(c, PaymentStore.toItem(c, r, sbn.getPostTime()));
        if (shown == null) return;
        PaymentInboxPlugin.notifyChanged();
        PaymentNotifier.present(c, shown);
    }

    private static String str(CharSequence s) {
        return s == null ? "" : s.toString();
    }
}
