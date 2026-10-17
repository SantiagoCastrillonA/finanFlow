package com.finanflow.app;

import android.content.Context;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Puente mínimo JS → widget: la web envía el resumen ya formateado y el widget lo pinta.
 * Desde JS: Capacitor.Plugins.WidgetBridge.update({ json })
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        String json = call.getString("json");
        if (json == null) {
            call.reject("Falta el parámetro json");
            return;
        }
        Context context = getContext();
        context
            .getSharedPreferences(BalanceWidgetProvider.PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(BalanceWidgetProvider.KEY_SUMMARY, json)
            .apply();
        BalanceWidgetProvider.updateAll(context);
        AllowanceWidgetProvider.updateAll(context);
        call.resolve();
    }
}
