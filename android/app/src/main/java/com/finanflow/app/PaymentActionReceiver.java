package com.finanflow.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import org.json.JSONArray;
import org.json.JSONObject;

/** Botones Registrar / Ignorar de la notificación de un pago (funcionan con la app cerrada). */
public class PaymentActionReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String id = intent.getStringExtra("id");
        if (id == null) return;
        PaymentNotifier.cancel(context, id);
        JSONObject item = PaymentStore.get(context, id);
        if (item == null) return;
        try {
            if (PaymentNotifier.ACTION_CONFIRM.equals(intent.getAction())) {
                // Se registra al abrir FinanFlow (la web crea el movimiento con un id fijo: no se duplica).
                item.put("status", "confirmed");
                PaymentStore.put(context, item);
            } else {
                PaymentStore.remove(context, new JSONArray().put(id));
            }
        } catch (Exception ignored) {}
        PaymentInboxPlugin.notifyChanged();
    }
}
