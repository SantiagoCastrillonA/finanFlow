package com.finanflow.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Widget pequeño (2×2): cuánto puedes gastar hoy según tus límites. Lee el mismo resumen que
 * BalanceWidgetProvider; el valor cambia cada día, así que solo vale el día en que se calculó.
 */
public class AllowanceWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        for (int id : widgetIds) {
            manager.updateAppWidget(id, buildViews(context));
        }
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, AllowanceWidgetProvider.class));
        for (int id : ids) {
            manager.updateAppWidget(id, buildViews(context));
        }
    }

    private static RemoteViews buildViews(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_allowance);
        String raw = context
            .getSharedPreferences(BalanceWidgetProvider.PREFS, Context.MODE_PRIVATE)
            .getString(BalanceWidgetProvider.KEY_SUMMARY, null);

        String label = context.getString(R.string.widget_stale);
        String value = "—";

        if (raw != null) {
            try {
                JSONObject summary = new JSONObject(raw);
                String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
                if (today.equals(summary.optString("allowanceDate"))) {
                    String allowance = summary.optString("allowance", "");
                    String over = summary.optString("allowanceOver", "");
                    if (!allowance.isEmpty()) {
                        label = context.getString(R.string.widget_allowance_label);
                        value = allowance;
                    } else if (!over.isEmpty()) {
                        label = context.getString(R.string.widget_allowance_over);
                        value = over;
                    } else {
                        label = context.getString(R.string.widget_allowance_none);
                    }
                }
            } catch (JSONException ignored) {
                // Resumen corrupto: se muestra el estado vacío hasta la próxima sincronización.
            }
        }

        views.setTextViewText(R.id.allowance_label, label);
        views.setTextViewText(R.id.allowance_value, value);

        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        views.setOnClickPendingIntent(R.id.allowance_root, PendingIntent.getActivity(context, 2, open, flags));
        return views;
    }
}
