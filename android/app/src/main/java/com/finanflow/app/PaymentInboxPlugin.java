package com.finanflow.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.lang.ref.WeakReference;
import java.util.Iterator;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Puente JS ↔ pagos detectados. Desde JS: Capacitor.Plugins.PaymentInbox.getQueue(), remove({ ids }),
 * setContext({ json }), learn({ merchant, category, links }), status(), setEnabled({ enabled })…
 * Evento "queueChanged" cuando llega o se confirma un pago con la app abierta.
 */
@CapacitorPlugin(name = "PaymentInbox")
public class PaymentInboxPlugin extends Plugin {

    private static WeakReference<PaymentInboxPlugin> current;

    @Override
    public void load() {
        current = new WeakReference<>(this);
        PaymentNotifier.ensureChannel(getContext());
    }

    static void notifyChanged() {
        PaymentInboxPlugin p = current == null ? null : current.get();
        if (p != null) p.notifyListeners("queueChanged", new JSObject());
    }

    @PluginMethod
    public void status(PluginCall call) {
        Context c = getContext();
        JSObject res = new JSObject();
        boolean enabled = PaymentStore.isEnabled(c);
        boolean allowed = NotificationManagerCompat.getEnabledListenerPackages(c).contains(c.getPackageName());
        // Autorizado pero sin conectar (pasa tras reinstalar): se pide de nuevo al abrir o volver a la app.
        if (enabled && allowed && !PaymentListenerService.connected) {
            PaymentListenerService.rebind(c);
            PaymentStore.noteDiag(c, "rebindAt", System.currentTimeMillis());
        }
        res.put("enabled", enabled);
        res.put("listener", allowed);
        res.put("connected", PaymentListenerService.connected);
        JSONObject d = PaymentStore.diag(c);
        res.put("seenAt", d.optLong("seenAt", 0));
        res.put("seenSource", d.has("seenSource") ? PaymentParser.sourceLabel(d.optString("seenSource")) : "");
        res.put("payAt", d.optLong("payAt", 0));
        res.put("payShown", d.optString("payShown", ""));
        res.put("overlay", Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(c));
        JSArray sources = new JSArray();
        JSONObject seen = PaymentStore.sources(c);
        for (Iterator<String> it = seen.keys(); it.hasNext(); ) {
            String label = PaymentParser.sourceLabel(seen.optString(it.next()));
            boolean dup = false;
            for (int i = 0; i < sources.length(); i++) if (label.equals(sources.optString(i))) dup = true;
            if (!dup) sources.put(label);
        }
        res.put("sources", sources);
        call.resolve(res);
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        PaymentStore.setEnabled(getContext(), Boolean.TRUE.equals(call.getBoolean("enabled", false)));
        call.resolve();
    }

    @PluginMethod
    public void openListenerSettings(PluginCall call) {
        openSettings(new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS"));
        call.resolve();
    }

    @PluginMethod
    public void openOverlaySettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 23) {
            openSettings(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getContext().getPackageName())));
        }
        call.resolve();
    }

    private void openSettings(Intent intent) {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
        } catch (Exception e) {
            Intent fallback = new Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(fallback);
        }
    }

    @PluginMethod
    public void setContext(PluginCall call) {
        String json = call.getString("json");
        if (json != null) PaymentStore.setContext(getContext(), json);
        call.resolve();
    }

    @PluginMethod
    public void getQueue(PluginCall call) {
        JSObject res = new JSObject();
        try {
            res.put("items", new JSArray(PaymentStore.queue(getContext()).toString()));
        } catch (JSONException e) {
            res.put("items", new JSArray());
        }
        call.resolve(res);
    }

    @PluginMethod
    public void remove(PluginCall call) {
        JSArray ids = call.getArray("ids", new JSArray());
        for (int i = 0; i < ids.length(); i++) PaymentNotifier.cancel(getContext(), ids.optString(i));
        PaymentStore.remove(getContext(), ids);
        call.resolve();
    }

    /** Deshacer "Ignorar": devuelve el pago a la cola. */
    @PluginMethod
    public void restore(PluginCall call) {
        JSObject item = call.getObject("item");
        if (item != null) PaymentStore.put(getContext(), item);
        call.resolve();
    }

    /**
     * Pago de ejemplo (Ajustes → Detectar pagos): pasa por el mismo lector y la misma tarjeta que uno de
     * Google Wallet. Marcado `test`: no se une con pagos reales, no aprende nada y la app no lo registra.
     */
    @PluginMethod
    public void test(PluginCall call) {
        Context c = getContext();
        try {
            PaymentParser.Result r = PaymentParser.parse("com.google.android.apps.walletnfcrel", "Tienda de prueba",
                "COP1,000.00 con Tarjeta de prueba ••0000", "");
            if (r == null) {
                call.reject("No se pudo leer el pago de prueba");
                return;
            }
            long now = System.currentTimeMillis();
            JSONObject item = PaymentStore.toItem(c, r, now);
            item.put("id", "test-" + now);
            item.put("test", true);
            item.put("account", ""); // siempre pregunta la cuenta, para probar también esa parte
            PaymentStore.put(c, item);
            notifyChanged();
            PaymentNotifier.present(c, item);
            call.resolve();
        } catch (JSONException e) {
            call.reject("No se pudo crear el pago de prueba");
        }
    }

    /** Lo que confirmaste en la app: comercio → categoría y tarjeta → cuenta, para la próxima vez. */
    @PluginMethod
    public void learn(PluginCall call) {
        Context c = getContext();
        PaymentStore.learnMerchant(c, call.getString("merchant"), call.getString("category"));
        JSObject links = call.getObject("links");
        if (links != null) {
            for (Iterator<String> it = links.keys(); it.hasNext(); ) {
                String key = it.next();
                PaymentStore.setLink(c, key, links.optString(key));
            }
        }
        call.resolve();
    }
}
