package com.finanflow.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONException;
import org.json.JSONObject;

/** Widget de pantalla de inicio: saldo, ingresos y gastos del mes y un botón para agregar. */
public class BalanceWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "finanflow_widget";
    static final String KEY_SUMMARY = "summary";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        for (int id : widgetIds) {
            manager.updateAppWidget(id, buildViews(context));
        }
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, BalanceWidgetProvider.class));
        for (int id : ids) {
            manager.updateAppWidget(id, buildViews(context));
        }
    }

    private static RemoteViews buildViews(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_balance);
        String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_SUMMARY, null);

        String balance = "—";
        String income = "—";
        String expense = "—";
        String subtitle = context.getString(R.string.widget_stale);

        if (raw != null) {
            try {
                JSONObject summary = new JSONObject(raw);
                balance = summary.optString("balance", "—");
                String currentMonth = new SimpleDateFormat("yyyy-MM", Locale.US).format(new Date());
                // Los totales del mes solo valen para el mes en que se calcularon.
                if (currentMonth.equals(summary.optString("monthKey"))) {
                    income = summary.optString("income", "—");
                    expense = summary.optString("expense", "—");
                    subtitle = context.getString(R.string.widget_balance_label) + " · " + summary.optString("monthLabel");
                }
            } catch (JSONException ignored) {
                // Resumen corrupto: se muestra el estado vacío hasta la próxima sincronización.
            }
        }

        views.setTextViewText(R.id.widget_subtitle, subtitle);
        views.setTextViewText(R.id.widget_balance, balance);
        views.setTextViewText(R.id.widget_income, income);
        views.setTextViewText(R.id.widget_expense, expense);

        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 0, open, pendingFlags()));

        // Reutiliza el deep link de los App Shortcuts.
        Intent add = new Intent(Intent.ACTION_VIEW, Uri.parse("finanflow://action/add-expense"), context, MainActivity.class);
        add.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        views.setOnClickPendingIntent(R.id.widget_add, PendingIntent.getActivity(context, 1, add, pendingFlags()));

        return views;
    }

    private static int pendingFlags() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return flags;
    }
}
