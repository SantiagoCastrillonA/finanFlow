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
        res.put("enabled", PaymentStore.isEnabled(c));
        res.put("listener", NotificationManagerCompat.getEnabledListenerPackages(c).contains(c.getPackageName()));
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
