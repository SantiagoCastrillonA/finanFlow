package com.finanflow.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins locales: deben registrarse antes de super.onCreate().
        registerPlugin(WidgetBridgePlugin.class);
        registerPlugin(PaymentInboxPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
