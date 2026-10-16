package com.finanflow.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.HapticFeedbackConstants;
import android.view.MotionEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Tarjeta flotante estilo iOS que baja desde arriba al detectar un pago: comercio, monto grande y dos
 * botones grandes. Vidrio real (desenfoque de lo que hay detrás) en Android 12+. Se puede seguir usando
 * la app de abajo; deslizar hacia arriba o esperar 15 s la deja en "Por confirmar".
 */
public class PaymentPromptActivity extends Activity {

    private static final long AUTO_HIDE_MS = 15000;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable autoHide = this::toPending;
    private String id;
    private JSONObject item;
    private boolean dark;
    private boolean closing;
    private float downY;
    private LinearLayout root;

    /** Abre la tarjeta para un pago. Devuelve false si Android no la deja abrir (se usa la notificación). */
    static boolean show(Context c, String id) {
        Intent i = new Intent(c, PaymentPromptActivity.class).putExtra("id", id);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            c.startActivity(i, PaymentNotifier.enterAnimation(c).toBundle());
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupWindow();
        load(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        load(intent);
    }

    private void load(Intent intent) {
        String newId = intent.getStringExtra("id");
        // Si había otro pago a la vista, queda en "Por confirmar" con su notificación.
        if (id != null && !id.equals(newId) && item != null) PaymentNotifier.notify(this, item, false);
        id = newId;
        item = id == null ? null : PaymentStore.get(this, id);
        if (item == null) {
            close();
            return;
        }
        render();
        restartTimer();
        root.post(() -> root.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY));
    }

    private void restartTimer() {
        handler.removeCallbacks(autoHide);
        handler.postDelayed(autoHide, AUTO_HIDE_MS);
    }

    private void setupWindow() {
        Window w = getWindow();
        dark = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        boolean blur = Build.VERSION.SDK_INT >= 31 && getWindowManager().isCrossWindowBlurEnabled();

        // Vidrio esmerilado (como las tarjetas grandes de la app): tinte translúcido de un solo color y
        // borde de luz. Con desenfoque el tinte es más transparente; sin él, casi sólido para que se lea
        // sobre cualquier pantalla (Wallet es blanca).
        GradientDrawable bg = new GradientDrawable();
        bg.setCornerRadius(dp(28));
        bg.setColor(dark ? (blur ? 0x9E132121 : 0xF2132121) : (blur ? 0xA6FFFFFF : 0xF5FFFFFF));
        bg.setStroke(Math.max(1, dp(0.5f)), dark ? 0x40FFFFFF : 0xBFFFFFFF);
        w.setBackgroundDrawable(bg);
        if (blur) w.setBackgroundBlurRadius(dp(40));
    }

    /**
     * Ancho y posición de la tarjeta. Va después de cada setContentView: en una ventana flotante Android
     * vuelve el tamaño a "lo justo para el contenido" al crear la vista, y la tarjeta quedaba angosta.
     */
    private void applyLayout() {
        Window w = getWindow();
        WindowManager.LayoutParams lp = w.getAttributes();
        int screen = getResources().getDisplayMetrics().widthPixels;
        lp.width = Math.min(screen - dp(16), dp(480)); // en tablet no se estira de lado a lado
        lp.height = WindowManager.LayoutParams.WRAP_CONTENT;
        lp.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        lp.y = statusBarHeight() + dp(6);
        lp.flags |= WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL; // los toques fuera van a la app de abajo
        lp.flags &= ~WindowManager.LayoutParams.FLAG_DIM_BEHIND;
        w.setAttributes(lp);
    }

    /* --- Colores (iOS) --- */

    private int primary() { return dark ? 0xFFFFFFFF : 0xFF000000; }
    private int secondary() { return dark ? 0x99EBEBF5 : 0x993C3C43; }
    private int fill() { return dark ? 0x1FFFFFFF : 0x0F000000; }
    private int accent() { return dark ? 0xFF11A08F : 0xFF0E8A7E; }
    private int amountColor() {
        String type = item.optString("type");
        // Un gasto no es una alarma: azul suave (como en la app); el rojo queda para deudas y límites.
        if ("expense".equals(type)) return dark ? 0xFF93C5FD : 0xFF2563EB;
        if ("income".equals(type)) return dark ? 0xFF4ADE80 : 0xFF16A34A;
        return primary();
    }

    private void render() {
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(16), dp(18), dp(10));
        root.setOnClickListener(v -> openInApp());

        // Encabezado: ícono de la app, "FinanFlow · Pago detectado", "ahora".
        LinearLayout header = new LinearLayout(this);
        header.setGravity(Gravity.CENTER_VERTICAL);
        ImageView icon = new ImageView(this);
        icon.setImageResource(R.drawable.ic_stat_finanflow);
        icon.setColorFilter(0xFFFFFFFF);
        icon.setPadding(dp(3), dp(3), dp(3), dp(3));
        icon.setBackground(rounded(accent(), dp(6)));
        header.addView(icon, new LinearLayout.LayoutParams(dp(22), dp(22)));
        TextView app = text("FinanFlow · " + PaymentNotifier.headline(item), 13, secondary(), false);
        LinearLayout.LayoutParams appLp = new LinearLayout.LayoutParams(0, -2, 1);
        appLp.leftMargin = dp(8);
        header.addView(app, appLp);
        header.addView(text("ahora", 13, secondary(), false));
        root.addView(header);

        TextView merchant = text(PaymentNotifier.merchant(item), 17, primary(), false);
        merchant.setAlpha(0.8f);
        merchant.setSingleLine(true);
        merchant.setEllipsize(TextUtils.TruncateAt.END);
        root.addView(merchant, margins(0, 12, 0, 0));

        TextView amount = text(PaymentNotifier.signedAmount(this, item), 44, amountColor(), true);
        amount.setLetterSpacing(-0.01f);
        amount.setSingleLine(true);
        root.addView(amount, margins(0, 0, 0, 0));

        // Categoría y cuenta en pastillas.
        LinearLayout chips = new LinearLayout(this);
        boolean transfer = "transfer".equals(item.optString("type"));
        if (!transfer) {
            chips.addView(chip(PaymentStore.categoryLabel(this, item.optString("type"), item.optString("category")), null), chipLp());
            chips.addView(chip(PaymentNotifier.accountOrKey(this, item.optString("account"), item.optString("cardKey")), null), chipLp());
        } else {
            chips.addView(chip(PaymentNotifier.route(this, item), null), chipLp());
        }
        HorizontalScrollView chipScroll = new HorizontalScrollView(this);
        chipScroll.setHorizontalScrollBarEnabled(false);
        chipScroll.addView(chips);
        root.addView(chipScroll, margins(0, 8, 0, 0));

        String missing = PaymentStore.missingField(item);
        if (missing != null) {
            // La primera vez con una tarjeta: elegir su cuenta con un toque (se recuerda).
            root.addView(text(question(missing), 15, primary(), true), margins(0, 16, 0, 8));
            LinearLayout options = new LinearLayout(this);
            JSONArray accounts = PaymentStore.accountsFor(this, item, missing);
            for (int i = 0; i < accounts.length(); i++) {
                JSONObject a = accounts.optJSONObject(i);
                if (a == null) continue;
                String accId = a.optString("id");
                TextView option = chip(a.optString("name"), v -> choose(missing, accId));
                option.setMinHeight(dp(48));
                option.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
                options.addView(option, chipLp());
            }
            HorizontalScrollView scroll = new HorizontalScrollView(this);
            scroll.setHorizontalScrollBarEnabled(false);
            scroll.addView(options);
            root.addView(scroll);
            root.addView(buttons("Ignorar", this::ignore, "Más tarde", this::toPending), margins(0, 14, 0, 0));
        } else {
            root.addView(buttons("Ignorar", this::ignore, "Registrar", this::confirm), margins(0, 16, 0, 0));
        }

        // Asa: indica que se puede deslizar hacia arriba.
        View handle = new View(this);
        handle.setBackground(rounded(dark ? 0x4DFFFFFF : 0x33000000, dp(2)));
        LinearLayout.LayoutParams handleLp = new LinearLayout.LayoutParams(dp(36), dp(4));
        handleLp.gravity = Gravity.CENTER_HORIZONTAL;
        handleLp.topMargin = dp(10);
        root.addView(handle, handleLp);

        setContentView(root);
        applyLayout();
    }

    private String question(String field) {
        if ("to".equals(field)) return "¿Qué cuenta es " + item.optString("toKey") + "?";
        if ("from".equals(field)) return "¿De qué cuenta salió?";
        return "¿Qué cuenta es " + item.optString("cardKey") + "?";
    }

    private void choose(String field, String accountId) {
        try {
            item.put(field, accountId);
        } catch (Exception ignored) {}
        // Un pago de prueba no deja aprendida su tarjeta: la próxima prueba vuelve a preguntar.
        if (!item.optBoolean("test")) PaymentStore.setLink(this, PaymentStore.keyFor(item, field), accountId);
        PaymentStore.put(this, item);
        PaymentInboxPlugin.notifyChanged();
        render();
        restartTimer();
    }

    private void confirm() {
        try {
            item.put("status", "confirmed");
        } catch (Exception ignored) {}
        PaymentStore.put(this, item);
        PaymentNotifier.cancel(this, id);
        PaymentInboxPlugin.notifyChanged();
        handler.removeCallbacks(autoHide);
        if (Build.VERSION.SDK_INT >= 30) root.performHapticFeedback(HapticFeedbackConstants.CONFIRM);
        showDone();
        handler.postDelayed(this::close, 650);
    }

    private void ignore() {
        PaymentStore.remove(this, new JSONArray().put(id));
        PaymentNotifier.cancel(this, id);
        PaymentInboxPlugin.notifyChanged();
        close();
    }

    /** Se esconde sin decidir: queda en "Por confirmar" y en la bandeja, en silencio. */
    private void toPending() {
        if (closing || item == null) return;
        PaymentNotifier.notify(this, item, false);
        close();
    }

    private void openInApp() {
        if (closing) return;
        startActivity(PaymentNotifier.reviewIntent(this, id));
        close();
    }

    private void close() {
        if (closing) return;
        closing = true;
        handler.removeCallbacksAndMessages(null);
        finish();
        overridePendingTransition(0, R.anim.prompt_out);
    }

    @Override
    public void onBackPressed() {
        toPending();
    }

    /** Deslizar hacia arriba la esconde (queda pendiente). Cualquier toque reinicia los 15 s. */
    @Override
    public boolean dispatchTouchEvent(MotionEvent e) {
        if (e.getActionMasked() == MotionEvent.ACTION_DOWN) {
            downY = e.getRawY();
            restartTimer();
        } else if (e.getActionMasked() == MotionEvent.ACTION_MOVE && downY - e.getRawY() > dp(36)) {
            toPending();
            return true;
        }
        return super.dispatchTouchEvent(e);
    }

    private void showDone() {
        int height = root.getHeight();
        LinearLayout done = new LinearLayout(this);
        done.setOrientation(LinearLayout.VERTICAL);
        done.setGravity(Gravity.CENTER);
        done.setMinimumHeight(height);
        TextView check = text("✓", 48, dark ? 0xFF4ADE80 : 0xFF16A34A, true);
        check.setGravity(Gravity.CENTER);
        done.addView(check);
        TextView label = text("Registrado", 17, primary(), true);
        label.setGravity(Gravity.CENTER);
        done.addView(label);
        root = done;
        setContentView(done);
        applyLayout();
    }

    /* --- Piezas --- */

    private LinearLayout buttons(String left, Runnable onLeft, String right, Runnable onRight) {
        LinearLayout row = new LinearLayout(this);
        TextView a = button(left, fill(), primary(), onLeft);
        TextView b = button(right, accent(), 0xFFFFFFFF, onRight);
        LinearLayout.LayoutParams lpA = new LinearLayout.LayoutParams(0, dp(56), 1);
        LinearLayout.LayoutParams lpB = new LinearLayout.LayoutParams(0, dp(56), 1);
        lpB.leftMargin = dp(10);
        row.addView(a, lpA);
        row.addView(b, lpB);
        return row;
    }

    private TextView button(String label, int bgColor, int textColor, Runnable onClick) {
        TextView b = text(label, 17, textColor, true);
        b.setGravity(Gravity.CENTER);
        b.setBackground(rounded(bgColor, dp(16)));
        b.setOnClickListener(v -> onClick.run());
        b.setOnTouchListener((v, e) -> {
            // Pulsación: escala 0.97 con salida rápida.
            if (e.getActionMasked() == MotionEvent.ACTION_DOWN) v.animate().scaleX(0.97f).scaleY(0.97f).setDuration(100).start();
            else if (e.getActionMasked() == MotionEvent.ACTION_UP || e.getActionMasked() == MotionEvent.ACTION_CANCEL)
                v.animate().scaleX(1f).scaleY(1f).setDuration(140).start();
            return false;
        });
        return b;
    }

    private TextView chip(String label, View.OnClickListener onClick) {
        TextView c = text(label, 15, primary(), false);
        c.setGravity(Gravity.CENTER);
        c.setSingleLine(true);
        c.setPadding(dp(12), dp(6), dp(12), dp(6));
        c.setBackground(rounded(fill(), dp(24)));
        if (onClick != null) c.setOnClickListener(onClick);
        return c;
    }

    private LinearLayout.LayoutParams chipLp() {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2);
        lp.rightMargin = dp(8);
        return lp;
    }

    private TextView text(String s, int sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(color);
        t.setTypeface(Typeface.create("sans-serif" + (bold ? "-medium" : ""), Typeface.NORMAL));
        if (sp >= 40) t.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));
        return t;
    }

    private LinearLayout.LayoutParams margins(int l, int t, int r, int b) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.setMargins(dp(l), dp(t), dp(r), dp(b));
        return lp;
    }

    private GradientDrawable rounded(int color, int radius) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(radius);
        return d;
    }

    private int statusBarHeight() {
        int res = getResources().getIdentifier("status_bar_height", "dimen", "android");
        return res > 0 ? getResources().getDimensionPixelSize(res) : dp(24);
    }

    private int dp(float v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }
}
