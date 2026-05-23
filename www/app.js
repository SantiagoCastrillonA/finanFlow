/**
 * ==========================================================================
 * FinanFlow - Controlador Principal de la Aplicación
 * Híbrido: Persistencia Local + Google Cloud Firebase (Firestore & Auth)
 * ==========================================================================
 */

// ==========================================================================
// CONFIGURACIÓN DE GOOGLE CLOUD FIREBASE
// ==========================================================================
// Reemplaza este objeto con tus credenciales de la consola de Firebase.
// Si lo dejas como null, la aplicación funcionará en "Modo Local" (localStorage) de manera fluida.
const firebaseConfig = {
  apiKey: "AIzaSyB1TR7ta9YJBRzVxohdJ0KoINTLOLEPhUI",
  authDomain: "finanflow-32cae.firebaseapp.com",
  projectId: "finanflow-32cae",
  storageBucket: "finanflow-32cae.firebasestorage.app",
  messagingSenderId: "119524136972",
  appId: "1:119524136972:web:711118945524e8c15e3629"
};

/*
Ejemplo de credenciales una vez creado tu proyecto en la consola de Firebase:
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD-xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  authDomain: "finanflow-santiago.firebaseapp.com",
  projectId: "finanflow-santiago",
  storageBucket: "finanflow-santiago.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:a1b2c3d4e5f6g7h8i9j0k"
};
*/

class FinanFlow {
  constructor() {
    // Configuración Inicial de Categorías con iconos y colores premium
    this.DEFAULT_CATEGORIES = {
      expense: [
        { id: "Comida", label: "Comida", icon: "restaurant", color: "#f87171" },
        { id: "Transporte", label: "Transporte", icon: "directions_car", color: "#60a5fa" },
        { id: "Compras", label: "Compras", icon: "shopping_bag", color: "#f472b6" },
        { id: "Entretenimiento", label: "Entretenimiento", icon: "theater_comedy", color: "#a78bfa" },
        { id: "Hogar/Servicios", label: "Hogar/Servicios", icon: "home", color: "#fbbf24" },
        { id: "Otros", label: "Otros", icon: "help_outline", color: "#94a3b8" }
      ],
      income: [
        { id: "Salario", label: "Salario", icon: "work", color: "#34d399" },
        { id: "Otros", label: "Otros", icon: "add_circle", color: "#10b981" }
      ]
    };

    // Estado en memoria de la aplicación
    this.state = {
      currency: "COP", // Peso Colombiano por defecto
      transactions: [],
      budgets: {},
      activeTab: "dashboard",
      filters: {
        type: "all",
        category: "all",
        date: "month",
        search: ""
      }
    };

    // Referencias a los Gráficos de Chart.js
    this.charts = {
      category: null,
      trend: null
    };

    // Variables de Firebase
    this.firebaseEnabled = false;
    this.db = null;
    this.auth = null;
    this.user = null;
    this.firestoreListeners = []; // Para desuscribir en logout

    // Inicializar al cargar el DOM
    window.addEventListener("DOMContentLoaded", () => this.init());
  }

  // ==========================================================================
  // Inicialización de la Aplicación
  // ==========================================================================
  init() {
    this.registerServiceWorker();
    this.initFirebase();
    this.loadStateLocal(); // Carga previa local para rapidez
    
    // Si no está Firebase o no hay sesión, y no hay datos locales, sembrar datos de demo
    if (!this.firebaseEnabled && this.state.transactions.length === 0) {
      this.seedSampleData();
    }

    this.initDOM();
    this.switchTab(this.state.activeTab);
    this.render();
  }

  // Registro de Service Worker para soporte offline
  registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js")
        .then(() => console.log("FinanFlow Service Worker Registrado."))
        .catch(err => console.warn("Error de Service Worker:", err));
    }
  }

  // Inicialización de Google Cloud Firebase
  initFirebase() {
    if (FIREBASE_CONFIG && typeof firebase !== "undefined") {
      try {
        // Inicializar app de Firebase
        firebase.initializeApp(FIREBASE_CONFIG);
        this.auth = firebase.auth();
        this.db = firebase.firestore();
        this.firebaseEnabled = true;

        // Activar persistencia local fuera de línea nativa en Firestore (base de datos local indexada)
        this.db.enablePersistence({ synchronizeTabs: true })
          .then(() => console.log("Persistencia offline de Firestore activada."))
          .catch((err) => {
            if (err.code === "failed-precondition") {
              console.warn("Múltiples pestañas abiertas, persistencia limitada.");
            } else if (err.code === "unimplemented") {
              console.warn("El navegador no soporta persistencia offline.");
            }
          });

        // Escuchar cambios en el estado de autenticación de Google
        this.auth.onAuthStateChanged(user => this.handleAuthStateChange(user));

      } catch (error) {
        console.error("Error al inicializar Firebase:", error);
        this.firebaseEnabled = false;
      }
    } else {
      console.log("Corriendo en Modo Local (Firebase deshabilitado o no configurado en app.js).");
    }
  }

  // ==========================================================================
  // Sincronización en la Nube (Google Cloud Firebase)
  // ==========================================================================
  
  handleAuthStateChange(user) {
    if (user) {
      this.user = user;
      console.log(`Usuario autenticado con Google: ${user.displayName} (${user.email})`);
      
      // Actualizar tarjeta de estado visual en Ajustes
      this.updateFirebaseStatusUI(true);
      
      // Preguntar si queremos migrar datos locales anteriores al iniciar sesión por primera vez
      this.migrateLocalDataToCloud();

      // Iniciar sincronización en tiempo real con Firestore
      this.syncWithFirestore();
    } else {
      // Cerrar sesión
      this.user = null;
      this.unsubscribeFirestore();
      
      // Limpiar estados de memoria que eran del usuario y recargar los locales
      this.loadStateLocal();
      this.updateFirebaseStatusUI(false);
      this.render();
      
      console.log("Sesión de Google cerrada.");
    }
  }

  // Sincronización en tiempo real con Firestore
  syncWithFirestore() {
    this.unsubscribeFirestore();

    const userDocRef = this.db.collection("users").doc(this.user.uid);

    // 1. Escuchar Transacciones del Usuario en Firestore
    const txListener = userDocRef.collection("transactions")
      .onSnapshot((querySnapshot) => {
        const txList = [];
        querySnapshot.forEach((doc) => {
          txList.push({ id: doc.id, ...doc.data() });
        });
        
        this.state.transactions = txList;
        this.saveStateLocalOnly(); // Mantener una copia en caché local rápida
        this.render();
        
        if (this.state.activeTab === "transactions") {
          this.filterTransactions();
        }
      }, (error) => {
        console.error("Error sincronizando transacciones:", error);
      });

    // 2. Escuchar Presupuestos del Usuario en Firestore
    const budgetListener = userDocRef.collection("budgets")
      .onSnapshot((querySnapshot) => {
        const budgets = {};
        querySnapshot.forEach((doc) => {
          budgets[doc.id] = doc.data().limit;
        });
        
        this.state.budgets = budgets;
        this.saveStateLocalOnly();
        this.render();
        
        if (this.state.activeTab === "budgets") {
          this.renderBudgetsList();
        }
      }, (error) => {
        console.error("Error sincronizando presupuestos:", error);
      });

    this.firestoreListeners.push(txListener, budgetListener);
  }

  unsubscribeFirestore() {
    this.firestoreListeners.forEach(unsubscribe => unsubscribe());
    this.firestoreListeners = [];
  }

  // Migrar datos locales previos al iniciar sesión con Google
  migrateLocalDataToCloud() {
    // Si tenemos transacciones locales que no están en la nube (ejemplo las sembradas o las creadas previas a iniciar sesión)
    const localData = localStorage.getItem("finanflow_state");
    if (!localData) return;

    try {
      const parsed = JSON.parse(localData);
      // Evitar migrar si ya fue migrado o si solo están los de demostración sin cambios
      if (parsed.transactions && parsed.transactions.length > 0 && !localStorage.getItem("finanflow_migrated")) {
        
        this.showConfirmDialog(
          "¿Sincronizar tus datos locales?",
          `Detectamos ${parsed.transactions.length} movimientos guardados en tu celular. ¿Deseas subirlos a tu cuenta de Google Cloud para consolidar tu historial?`,
          async () => {
            const batch = this.db.batch();
            const userDocRef = this.db.collection("users").doc(this.user.uid);

            // Migrar Transacciones
            parsed.transactions.forEach(t => {
              // Saltar las semillas de demostración para evitar duplicados
              if (t.id.startsWith("seed-")) return;
              
              const docRef = userDocRef.collection("transactions").doc(t.id);
              batch.set(docRef, t);
            });

            // Migrar Presupuestos
            if (parsed.budgets) {
              Object.keys(parsed.budgets).forEach(cat => {
                const docRef = userDocRef.collection("budgets").doc(cat);
                batch.set(docRef, { limit: parsed.budgets[cat] });
              });
            }

            await batch.commit();
            localStorage.setItem("finanflow_migrated", "true");
            console.log("Migración local exitosa a Google Cloud Firestore.");
            alert("¡Tus datos locales se han subido con éxito a tu cuenta de Google Cloud!");
          }
        );
      }
    } catch (e) {
      console.error("Error en migración:", e);
    }
  }

  // Iniciar Sesión con Google
  loginWithGoogle() {
    if (!this.firebaseEnabled) {
      this.showFirebaseConfigInstructions();
      return;
    }
    const provider = new firebase.auth.GoogleAuthProvider();
    
    // Cerramos el modal visual mientras carga
    this.closeLoginModal();

    // signInWithPopup funciona excelente para Capacitor y Web
    this.auth.signInWithPopup(provider)
      .then((result) => {
        console.log("Inicio de sesión completado:", result.user.displayName);
      })
      .catch((error) => {
        console.error("Error al iniciar sesión con Google:", error);
        alert("No pudimos iniciar sesión con Google: " + error.message);
      });
  }

  // Cerrar Sesión de Google
  logoutFirebase() {
    if (this.auth) {
      this.showConfirmDialog(
        "¿Cerrar Sesión?",
        "Tu aplicación volverá a funcionar en Modo Local y no se sincronizará con Google Cloud hasta que inicies sesión nuevamente.",
        () => {
          this.auth.signOut();
        }
      );
    }
  }

  // Manejar el botón de Ajustes sobre el estado de la nube
  handleFirebaseSettingsAction() {
    if (!this.firebaseEnabled) {
      this.showFirebaseConfigInstructions();
    } else if (this.user) {
      this.logoutFirebase();
    } else {
      this.openLoginModal();
    }
  }

  // Mostrar el modal explicativo de login
  openLoginModal() {
    document.getElementById("login-modal").classList.add("active");
  }

  closeLoginModal() {
    document.getElementById("login-modal").classList.remove("active");
  }

  skipLogin() {
    this.closeLoginModal();
  }

  // UI dinámica para la sincronización con Google Cloud
  updateFirebaseStatusUI(online) {
    const icon = document.getElementById("firebase-status-icon");
    const title = document.getElementById("firebase-status-title");
    const subtitle = document.getElementById("firebase-status-subtitle");
    const btn = document.getElementById("firebase-action-btn");

    if (!icon || !title || !subtitle || !btn) return;

    if (!this.firebaseEnabled) {
      // Caso 1: Firebase no configurado en app.js
      icon.textContent = "cloud_off";
      icon.style.color = "var(--text-muted)";
      title.textContent = "Modo Local Activo";
      subtitle.textContent = "Sincronización inactiva. Toca para ver cómo configurar Google Cloud.";
      btn.textContent = "Guía";
      btn.className = "btn-secondary";
      btn.style.padding = "6px 12px";
    } else if (online && this.user) {
      // Caso 2: Autenticado y sincronizando
      icon.textContent = "cloud_done";
      icon.style.color = "var(--income)";
      title.textContent = "Sincronizado con Google";
      subtitle.textContent = `${this.user.displayName} (${this.user.email})`;
      btn.textContent = "Salir";
      btn.className = "btn-secondary";
      btn.style.color = "var(--expense)";
    } else {
      // Caso 3: Firebase activo pero sesión cerrada
      icon.textContent = "cloud_queue";
      icon.style.color = "var(--primary)";
      title.textContent = "Nube lista para Conectar";
      subtitle.textContent = "Sincroniza tus registros usando tu cuenta de Google.";
      btn.textContent = "Conectar";
      btn.className = "btn-primary-small";
      btn.style.color = "#fff";
    }
  }

  // Instrucciones interactivas para el desarrollador en pantalla
  showFirebaseConfigInstructions() {
    alert(
      "💻 ¡HOLA DESARROLLADOR! \n\n" +
      "Para activar la base de datos en tiempo real de Google Cloud:\n\n" +
      "1. Ve a la consola oficial de Firebase (https://console.firebase.google.com/).\n" +
      "2. Crea un proyecto gratuito y añade una aplicación Web.\n" +
      "3. En los ajustes de Firebase, activa los servicios de:\n" +
      "   - Firestore Database (crea la base de datos en 'Modo prueba')\n" +
      "   - Authentication (activa el método de inicio de sesión con 'Google')\n" +
      "4. Copia tu objeto de configuración y pégalo en la variable 'FIREBASE_CONFIG' ubicada al principio de este archivo (app.js).\n\n" +
      "¡El sistema detectará tus credenciales automáticamente y habilitará el inicio de sesión nativo!"
    );
  }

  // ==========================================================================
  // Operaciones de Persistencia Local (LocalStorage de respaldo y Modo Offline)
  // ==========================================================================
  loadStateLocal() {
    const savedState = localStorage.getItem("finanflow_state");
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        this.state.currency = parsed.currency || "COP";
        this.state.transactions = parsed.transactions || [];
        this.state.budgets = parsed.budgets || {};
      } catch (e) {
        console.error("Error leyendo LocalStorage:", e);
      }
    }
  }

  saveStateLocalOnly() {
    localStorage.setItem("finanflow_state", JSON.stringify({
      currency: this.state.currency,
      transactions: this.state.transactions,
      budgets: this.state.budgets
    }));
  }

  saveState() {
    this.saveStateLocalOnly();

    // Si Firebase está activo y el usuario tiene sesión, sincronizar inmediatamente a la nube
    if (this.firebaseEnabled && this.user) {
      // Las transacciones se guardan dinámicamente mediante las operaciones CRUD individuales en Firestore
      // para evitar reescribir toda la base de datos (óptimo para red y base de datos)
    }
  }

  // Sembramos datos iniciales realistas para COP si la aplicación está limpia
  seedSampleData() {
    const today = new Date();
    const formatDate = (daysAgo) => {
      const d = new Date(today);
      d.setDate(today.getDate() - daysAgo);
      return d.toISOString().split("T")[0];
    };

    this.state.transactions = [
      {
        id: "seed-1",
        type: "income",
        amount: 3200000,
        category: "Salario",
        date: formatDate(10),
        method: "Cuenta Bancaria",
        note: "Pago de Nómina Mensual"
      },
      {
        id: "seed-2",
        type: "expense",
        amount: 145000,
        category: "Comida",
        date: formatDate(0),
        method: "Tarjeta de Crédito",
        note: "Cena familiar Restaurante"
      },
      {
        id: "seed-3",
        type: "expense",
        amount: 45000,
        category: "Transporte",
        date: formatDate(1),
        method: "Nequi/Daviplata",
        note: "Viajes Uber de la semana"
      },
      {
        id: "seed-4",
        type: "expense",
        amount: 120000,
        category: "Hogar/Servicios",
        date: formatDate(4),
        method: "Cuenta Bancaria",
        note: "Factura de Internet Fibra"
      },
      {
        id: "seed-5",
        type: "expense",
        amount: 85000,
        category: "Entretenimiento",
        date: formatDate(2),
        method: "Efectivo",
        note: "Entradas Cine y Snacks"
      },
      {
        id: "seed-6",
        type: "expense",
        amount: 250000,
        category: "Compras",
        date: formatDate(7),
        method: "Tarjeta de Crédito",
        note: "Zapatos Deportivos"
      }
    ];

    this.state.budgets = {
      "Comida": 500000,
      "Transporte": 150000
    };

    this.saveStateLocalOnly();
  }

  initDOM() {
    this.populateCategorySelects();
    document.getElementById("tx-date").value = new Date().toISOString().split("T")[0];
    document.getElementById("settings-currency").value = this.state.currency;
    this.setupBottomSheetGesture();
    this.updateFirebaseStatusUI(false);
  }

  // ==========================================================================
  // Formateadores y Utilidades
  // ==========================================================================
  formatMoney(amount) {
    const locale = {
      COP: "es-CO",
      USD: "en-US",
      EUR: "de-DE",
      MXN: "es-MX",
      ARS: "es-AR",
      CLP: "es-CL",
      PEN: "es-PE"
    }[this.state.currency] || "es-CO";

    const config = {
      style: "currency",
      currency: this.state.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    };

    if (this.state.currency === "USD" || this.state.currency === "EUR") {
      config.minimumFractionDigits = 2;
      config.maximumFractionDigits = 2;
    }

    return new Intl.NumberFormat(locale, config).format(amount);
  }

  getCategoryInfo(catId, type = "expense") {
    const categoriesList = this.DEFAULT_CATEGORIES[type];
    const cat = categoriesList.find(c => c.id === catId);
    if (cat) return cat;

    const fallbackList = type === "expense" ? this.DEFAULT_CATEGORIES.income : this.DEFAULT_CATEGORIES.expense;
    const fallbackCat = fallbackList.find(c => c.id === catId);
    if (fallbackCat) return fallbackCat;

    return { id: catId, label: catId, icon: "payments", color: "#94a3b8" };
  }

  populateCategorySelects() {
    const txCatSelect = document.getElementById("tx-category");
    const budgetCatSelect = document.getElementById("budget-category");
    const filterCatSelect = document.getElementById("filter-category");

    txCatSelect.innerHTML = "";
    budgetCatSelect.innerHTML = "";
    filterCatSelect.innerHTML = '<option value="all">Todas las categorías</option>';

    const optGroupExpense = document.createElement("optgroup");
    optGroupExpense.label = "Gastos";
    this.DEFAULT_CATEGORIES.expense.forEach(c => {
      optGroupExpense.appendChild(new Option(c.label, c.id));
    });

    const optGroupIncome = document.createElement("optgroup");
    optGroupIncome.label = "Ingresos";
    this.DEFAULT_CATEGORIES.income.forEach(c => {
      optGroupIncome.appendChild(new Option(c.label, c.id));
    });

    txCatSelect.appendChild(optGroupExpense);
    txCatSelect.appendChild(optGroupIncome);

    this.DEFAULT_CATEGORIES.expense.forEach(c => {
      budgetCatSelect.appendChild(new Option(c.label, c.id));
    });

    this.DEFAULT_CATEGORIES.expense.forEach(c => {
      filterCatSelect.appendChild(new Option(c.label, c.id));
    });
    this.DEFAULT_CATEGORIES.income.forEach(c => {
      filterCatSelect.appendChild(new Option(c.label, c.id));
    });
  }

  // ==========================================================================
  // Enrutamiento / Navegación por pestañas (SPA)
  // ==========================================================================
  switchTab(tabId) {
    this.state.activeTab = tabId;
    
    document.querySelectorAll(".tab-view").forEach(tab => {
      tab.classList.remove("active");
    });
    const currentTab = document.getElementById(`tab-${tabId}`);
    if (currentTab) currentTab.classList.add("active");

    document.querySelectorAll(".nav-item").forEach(btn => {
      btn.classList.remove("active");
    });
    const activeBtn = document.getElementById(`nav-btn-${tabId}`);
    if (activeBtn) activeBtn.classList.add("active");

    if (tabId === "dashboard") {
      setTimeout(() => this.renderCharts(), 50);
    } else if (tabId === "transactions") {
      this.filterTransactions();
    } else if (tabId === "budgets") {
      this.renderBudgetsList();
    }

    document.querySelector(".app-content").scrollTop = 0;
  }

  setupBottomSheetGesture() {
    const sheet = document.querySelector(".modal-content.bottom-sheet");
    const overlay = document.getElementById("transaction-modal");
    if (!sheet || !overlay) return;
    
    let startY = 0;
    let currentY = 0;

    sheet.addEventListener("touchstart", (e) => {
      startY = e.touches[0].clientY;
    }, { passive: true });

    sheet.addEventListener("touchmove", (e) => {
      currentY = e.touches[0].clientY;
      const diffY = currentY - startY;
      if (diffY > 0 && sheet.scrollTop === 0) {
        sheet.style.transform = `translateY(${diffY}px)`;
        sheet.style.transition = "none";
      }
    }, { passive: true });

    sheet.addEventListener("touchend", () => {
      sheet.style.transition = "";
      const diffY = currentY - startY;
      if (diffY > 120 && sheet.scrollTop === 0) {
        this.closeTransactionModal();
      } else {
        sheet.style.transform = "";
      }
      startY = 0;
      currentY = 0;
    });
  }

  // ==========================================================================
  // Renderización General
  // ==========================================================================
  render() {
    this.renderBalances();
    this.renderRecentTransactions();
    this.renderCharts();
    this.renderBudgetAlerts();
    this.updateFirebaseStatusUI(this.user ? true : false);
  }

  renderBalances() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let totalIncomes = 0;
    let totalExpenses = 0;

    this.state.transactions.forEach(t => {
      const tDate = new Date(t.date + "T00:00:00");
      if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
        if (t.type === "income") {
          totalIncomes += parseFloat(t.amount);
        } else {
          totalExpenses += parseFloat(t.amount);
        }
      }
    });

    let netBalance = 0;
    this.state.transactions.forEach(t => {
      if (t.type === "income") {
        netBalance += parseFloat(t.amount);
      } else {
        netBalance -= parseFloat(t.amount);
      }
    });

    document.getElementById("total-balance").textContent = this.formatMoney(netBalance);
    document.getElementById("total-incomes").textContent = this.formatMoney(totalIncomes);
    document.getElementById("total-expenses").textContent = this.formatMoney(totalExpenses);

    const currencySym = this.state.currency === "EUR" ? "€" : "$";
    document.getElementById("modal-currency-symbol").textContent = currencySym;
    document.getElementById("budget-currency-symbol").textContent = currencySym;
  }

  renderRecentTransactions() {
    const listContainer = document.getElementById("recent-transactions-list");
    if (!listContainer) return;
    listContainer.innerHTML = "";

    const sorted = [...this.state.transactions]
      .sort((a, b) => new Date(b.date + "T00:00:00") - new Date(a.date + "T00:00:00"))
      .slice(0, 4);

    if (sorted.length === 0) {
      listContainer.innerHTML = `
        <div class="no-data-placeholder" style="position: relative; margin: 32px 0;">
          <span class="material-symbols-rounded">playlist_add</span>
          <p>No hay transacciones registradas</p>
        </div>`;
      return;
    }

    sorted.forEach(t => {
      const catInfo = this.getCategoryInfo(t.category, t.type);
      const sign = t.type === "income" ? "+" : "-";
      const formattedAmount = this.formatMoney(t.amount);

      const item = document.createElement("div");
      item.className = "transaction-item";
      item.onclick = () => this.openTransactionModal(t.id);

      item.innerHTML = `
        <div class="tx-left">
          <div class="tx-category-icon" style="background-color: ${catInfo.color}15; color: ${catInfo.color};">
            <span class="material-symbols-rounded">${catInfo.icon}</span>
          </div>
          <div class="tx-info">
            <span class="tx-description">${t.note || t.category}</span>
            <div class="tx-meta">
              <span class="tx-badge">${t.method}</span>
              <span>${this.formatDateFriendly(t.date)}</span>
            </div>
          </div>
        </div>
        <div class="tx-right">
          <span class="tx-amount ${t.type}">${sign} ${formattedAmount}</span>
        </div>
      `;

      listContainer.appendChild(item);
    });
  }

  formatDateFriendly(dateStr) {
    const parts = dateStr.split("-");
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Hoy";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Ayer";
    }

    const options = { day: "numeric", month: "short" };
    return date.toLocaleDateString("es-CO", options);
  }

  // ==========================================================================
  // Renderización de Gráficas
  // ==========================================================================
  renderCharts() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // 1. Dona de Gastos por Categoría
    const expenseData = {};
    let totalMonthExpenses = 0;

    this.state.transactions.forEach(t => {
      if (t.type === "expense") {
        const tDate = new Date(t.date + "T00:00:00");
        if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
          expenseData[t.category] = (expenseData[t.category] || 0) + parseFloat(t.amount);
          totalMonthExpenses += parseFloat(t.amount);
        }
      }
    });

    const donutCanvas = document.getElementById("categoryChart");
    const noChartPlaceholder = document.getElementById("no-chart-data");

    if (!donutCanvas) return;

    if (totalMonthExpenses === 0) {
      donutCanvas.style.display = "none";
      if (noChartPlaceholder) noChartPlaceholder.classList.remove("hidden");
    } else {
      donutCanvas.style.display = "block";
      if (noChartPlaceholder) noChartPlaceholder.classList.add("hidden");

      const labels = Object.keys(expenseData);
      const data = Object.values(expenseData);
      const colors = labels.map(label => this.getCategoryInfo(label, "expense").color);

      if (this.charts.category) {
        this.charts.category.destroy();
      }

      this.charts.category = new Chart(donutCanvas, {
        type: "doughnut",
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: "#131b2e",
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "70%",
          plugins: {
            legend: {
              position: "right",
              labels: {
                color: "#e2e8f0",
                boxWidth: 12,
                font: { family: "Inter", size: 11, weight: "500" },
                padding: 10
              }
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const val = context.raw;
                  const pct = ((val / totalMonthExpenses) * 100).toFixed(1);
                  return ` ${context.label}: ${this.formatMoney(val)} (${pct}%)`;
                }
              }
            }
          }
        }
      });
    }

    // 2. Línea de Tendencia de Saldo
    const trendCanvas = document.getElementById("trendChart");
    const noTrendPlaceholder = document.getElementById("no-trend-data");

    if (!trendCanvas) return;

    if (this.state.transactions.length === 0) {
      trendCanvas.style.display = "none";
      if (noTrendPlaceholder) noTrendPlaceholder.classList.remove("hidden");
      return;
    }

    trendCanvas.style.display = "block";
    if (noTrendPlaceholder) noTrendPlaceholder.classList.add("hidden");

    const dateMap = {};
    const daysToShow = 7;
    const today = new Date();

    for (let i = daysToShow - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      dateMap[dateStr] = 0;
    }

    const chronSorted = [...this.state.transactions].sort((a, b) => new Date(a.date + "T00:00:00") - new Date(b.date + "T00:00:00"));

    let cumulativeBalance = 0;
    const windowStartStr = Object.keys(dateMap)[0];
    const windowStartDate = new Date(windowStartStr + "T00:00:00");

    chronSorted.forEach(t => {
      const tDate = new Date(t.date + "T00:00:00");
      if (tDate < windowStartDate) {
        cumulativeBalance += t.type === "income" ? parseFloat(t.amount) : -parseFloat(t.amount);
      }
    });

    const labelsTrend = [];
    const dataTrend = [];

    Object.keys(dateMap).forEach(day => {
      const daysTxs = this.state.transactions.filter(t => t.date === day);
      daysTxs.forEach(t => {
        cumulativeBalance += t.type === "income" ? parseFloat(t.amount) : -parseFloat(t.amount);
      });
      
      dateMap[day] = cumulativeBalance;

      const parts = day.split("-");
      const labelDate = new Date(parts[0], parts[1] - 1, parts[2]);
      labelsTrend.push(labelDate.toLocaleDateString("es-CO", { day: "numeric", month: "short" }));
      dataTrend.push(cumulativeBalance);
    });

    if (this.charts.trend) {
      this.charts.trend.destroy();
    }

    const ctx = trendCanvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, "rgba(99, 102, 241, 0.4)");
    gradient.addColorStop(1, "rgba(99, 102, 241, 0.0)");

    this.charts.trend = new Chart(trendCanvas, {
      type: "line",
      data: {
        labels: labelsTrend,
        datasets: [{
          label: "Balance Acumulado",
          data: dataTrend,
          borderColor: "#6366f1",
          borderWidth: 3,
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#8b5cf6",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            grid: { color: "rgba(255, 255, 255, 0.05)" },
            ticks: {
              color: "#94a3b8",
              font: { family: "Inter", size: 10 },
              callback: (value) => this.formatMoney(value)
            }
          },
          x: {
            grid: { display: false },
            ticks: { color: "#94a3b8", font: { family: "Inter", size: 10 } }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => ` Balance: ${this.formatMoney(context.raw)}`
            }
          }
        }
      }
    });
  }

  // ==========================================================================
  // Presupuestos Lógica
  // ==========================================================================
  calculateBudgetUsage() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const usage = {};

    Object.keys(this.state.budgets).forEach(cat => {
      usage[cat] = 0;
    });

    this.state.transactions.forEach(t => {
      if (t.type === "expense" && this.state.budgets[t.category] !== undefined) {
        const tDate = new Date(t.date + "T00:00:00");
        if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
          usage[t.category] += parseFloat(t.amount);
        }
      }
    });

    return usage;
  }

  renderBudgetAlerts() {
    const container = document.getElementById("budget-alerts");
    if (!container) return;
    container.innerHTML = "";

    const usage = this.calculateBudgetUsage();
    let hasAlerts = false;

    Object.keys(this.state.budgets).forEach(cat => {
      const limit = this.state.budgets[cat];
      const spent = usage[cat];
      const percent = (spent / limit) * 100;

      if (percent >= 100) {
        hasAlerts = true;
        const alert = document.createElement("div");
        alert.className = "budget-alert danger";
        alert.innerHTML = `
          <span class="material-symbols-rounded">error</span>
          <span>¡Presupuesto de <strong>${cat}</strong> excedido! Gastado: ${this.formatMoney(spent)} / Límite: ${this.formatMoney(limit)}</span>
        `;
        container.appendChild(alert);
      } else if (percent >= 80) {
        hasAlerts = true;
        const alert = document.createElement("div");
        alert.className = "budget-alert warning";
        alert.innerHTML = `
          <span class="material-symbols-rounded">warning</span>
          <span>Presupuesto de <strong>${cat}</strong> cerca al límite (${percent.toFixed(0)}%). Gastado: ${this.formatMoney(spent)} / Límite: ${this.formatMoney(limit)}</span>
        `;
        container.appendChild(alert);
      }
    });

    if (hasAlerts) {
      container.classList.remove("hidden");
    } else {
      container.classList.add("hidden");
    }
  }

  renderBudgetsList() {
    const listContainer = document.getElementById("budgets-list");
    if (!listContainer) return;
    listContainer.innerHTML = "";

    const usage = this.calculateBudgetUsage();
    const categoriesWithBudget = Object.keys(this.state.budgets);

    if (categoriesWithBudget.length === 0) {
      listContainer.innerHTML = `
        <div class="no-data-placeholder" style="position: relative; margin: 64px 0;">
          <span class="material-symbols-rounded">savings</span>
          <p>No has configurado ningún límite mensual</p>
        </div>`;
      return;
    }

    categoriesWithBudget.forEach(cat => {
      const limit = this.state.budgets[cat];
      const spent = usage[cat] || 0;
      const percent = Math.min((spent / limit) * 100, 100);
      const catInfo = this.getCategoryInfo(cat, "expense");

      let fillClass = "fill-safe";
      let statusClass = "safe";
      let statusText = "Bajo control";

      if (spent >= limit) {
        fillClass = "fill-danger";
        statusClass = "danger";
        statusText = "Excedido";
      } else if (percent >= 80) {
        fillClass = "fill-warning";
        statusClass = "warning";
        statusText = "Límite cercano";
      }

      const card = document.createElement("div");
      card.className = "budget-item-card";
      card.innerHTML = `
        <div class="budget-item-header">
          <div class="budget-cat-info">
            <div class="budget-icon-badge" style="background-color: ${catInfo.color}15; color: ${catInfo.color};">
              <span class="material-symbols-rounded">${catInfo.icon}</span>
            </div>
            <span class="budget-cat-name">${cat}</span>
          </div>
          <div class="budget-limits-text">
            <span class="budget-spent-heavy">${this.formatMoney(spent)}</span> / ${this.formatMoney(limit)}
          </div>
        </div>
        
        <div class="budget-progress-track">
          <div class="budget-progress-fill ${fillClass}" style="width: ${percent}%;"></div>
        </div>

        <div class="budget-item-footer">
          <span class="budget-status-label ${statusClass}">${statusText} (${percent.toFixed(0)}%)</span>
          <div class="budget-actions">
            <button class="budget-btn edit" onclick="app.openBudgetModal('${cat}')" aria-label="Editar presupuesto">
              <span class="material-symbols-rounded">edit</span>
            </button>
            <button class="budget-btn delete" onclick="app.deleteBudget('${cat}')" aria-label="Eliminar presupuesto">
              <span class="material-symbols-rounded">delete</span>
            </button>
          </div>
        </div>
      `;

      listContainer.appendChild(card);
    });
  }

  // ==========================================================================
  // Historial de Transacciones
  // ==========================================================================
  setTransactionFilterType(type, element) {
    this.state.filters.type = type;
    
    document.querySelectorAll(".filter-chip").forEach(chip => {
      chip.classList.remove("active");
    });
    element.classList.add("active");

    this.filterTransactions();
  }

  filterTransactions() {
    const searchVal = document.getElementById("search-input");
    this.state.filters.search = searchVal ? searchVal.value.toLowerCase() : "";
    this.state.filters.category = document.getElementById("filter-category").value;
    this.state.filters.date = document.getElementById("filter-date").value;

    const listContainer = document.getElementById("all-transactions-list");
    if (!listContainer) return;
    listContainer.innerHTML = "";

    let filtered = this.state.transactions.filter(t => {
      if (this.state.filters.type !== "all" && t.type !== this.state.filters.type) {
        return false;
      }

      if (this.state.filters.category !== "all" && t.category !== this.state.filters.category) {
        return false;
      }

      if (this.state.filters.search) {
        const noteMatch = (t.note || "").toLowerCase().includes(this.state.filters.search);
        const catMatch = t.category.toLowerCase().includes(this.state.filters.search);
        if (!noteMatch && !catMatch) return false;
      }

      if (this.state.filters.date !== "all") {
        const tDate = new Date(t.date + "T00:00:00");
        const today = new Date();
        today.setHours(0,0,0,0);

        if (this.state.filters.date === "today") {
          const checkDate = new Date(t.date + "T00:00:00");
          if (checkDate.toDateString() !== today.toDateString()) return false;
        } 
        else if (this.state.filters.date === "week") {
          const oneWeekAgo = new Date(today);
          oneWeekAgo.setDate(today.getDate() - 7);
          if (tDate < oneWeekAgo) return false;
        } 
        else if (this.state.filters.date === "month") {
          if (tDate.getMonth() !== today.getMonth() || tDate.getFullYear() !== today.getFullYear()) {
            return false;
          }
        } 
        else if (this.state.filters.date === "last-month") {
          let lastMonth = today.getMonth() - 1;
          let year = today.getFullYear();
          if (lastMonth < 0) {
            lastMonth = 11;
            year -= 1;
          }
          if (tDate.getMonth() !== lastMonth || tDate.getFullYear() !== year) {
            return false;
          }
        }
      }

      return true;
    });

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="no-data-placeholder" style="position: relative; margin: 64px 0;">
          <span class="material-symbols-rounded">search_off</span>
          <p>No se encontraron transacciones</p>
        </div>`;
      return;
    }

    filtered.sort((a, b) => new Date(b.date + "T00:00:00") - new Date(a.date + "T00:00:00"));

    const groups = {};
    filtered.forEach(t => {
      if (!groups[t.date]) {
        groups[t.date] = [];
      }
      groups[t.date].push(t);
    });

    Object.keys(groups).forEach(date => {
      const groupEl = document.createElement("div");
      groupEl.className = "transaction-group";
      
      const dateTitle = document.createElement("div");
      dateTitle.className = "group-date";
      dateTitle.textContent = this.formatDateGroupHeader(date);
      groupEl.appendChild(dateTitle);

      groups[date].forEach(t => {
        const catInfo = this.getCategoryInfo(t.category, t.type);
        const sign = t.type === "income" ? "+" : "-";
        const formattedAmount = this.formatMoney(t.amount);

        const item = document.createElement("div");
        item.className = "transaction-item";

        item.innerHTML = `
          <div class="tx-left" onclick="app.openTransactionModal('${t.id}')">
            <div class="tx-category-icon" style="background-color: ${catInfo.color}15; color: ${catInfo.color};">
              <span class="material-symbols-rounded">${catInfo.icon}</span>
            </div>
            <div class="tx-info">
              <span class="tx-description">${t.note || t.category}</span>
              <div class="tx-meta">
                <span class="tx-badge">${t.method}</span>
                <span>${t.category}</span>
              </div>
            </div>
          </div>
          <div class="tx-right">
            <span class="tx-amount ${t.type}">${sign} ${formattedAmount}</span>
            <div class="tx-action-btns">
              <button class="tx-action-btn edit" onclick="app.openTransactionModal('${t.id}')" aria-label="Editar">
                <span class="material-symbols-rounded">edit</span>
              </button>
              <button class="tx-action-btn delete" onclick="app.deleteTransaction('${t.id}')" aria-label="Borrar">
                <span class="material-symbols-rounded">delete</span>
              </button>
            </div>
          </div>
        `;
        groupEl.appendChild(item);
      });

      listContainer.appendChild(groupEl);
    });
  }

  formatDateGroupHeader(dateStr) {
    const parts = dateStr.split("-");
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "HOY - " + date.toLocaleDateString("es-CO", { day: "numeric", month: "long" }).toUpperCase();
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "AYER - " + date.toLocaleDateString("es-CO", { day: "numeric", month: "long" }).toUpperCase();
    }

    const options = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
    return date.toLocaleDateString("es-CO", options).toUpperCase();
  }

  // ==========================================================================
  // Formulario y Operaciones CRUD
  // ==========================================================================
  openTransactionModal(editId = null) {
    const modal = document.getElementById("transaction-modal");
    const form = document.getElementById("transaction-form");
    const titleEl = document.getElementById("modal-title");

    form.reset();
    document.getElementById("tx-date").value = new Date().toISOString().split("T")[0];

    if (editId) {
      titleEl.textContent = "Editar Transacción";
      const tx = this.state.transactions.find(t => t.id === editId);
      if (!tx) return;

      document.getElementById("tx-id").value = tx.id;
      document.getElementById("tx-amount").value = tx.amount;
      document.getElementById("tx-date").value = tx.date;
      document.getElementById("tx-method").value = tx.method;
      document.getElementById("tx-note").value = tx.note;

      this.toggleTransactionTypeForm(tx.type);
      document.getElementById(`type-${tx.type}`).checked = true;
      document.getElementById("tx-category").value = tx.category;
    } else {
      titleEl.textContent = "Agregar Transacción";
      document.getElementById("tx-id").value = "";
      this.toggleTransactionTypeForm("expense");
      document.getElementById("type-expense").checked = true;
    }

    modal.classList.add("active");
    setTimeout(() => {
      document.getElementById("tx-amount").focus();
    }, 100);
  }

  closeTransactionModal() {
    document.getElementById("transaction-modal").classList.remove("active");
    const bSheet = document.querySelector(".modal-content.bottom-sheet");
    if (bSheet) bSheet.style.transform = "";
  }

  toggleTransactionTypeForm(type) {
    const expBtn = document.getElementById("type-expense-btn");
    const incBtn = document.getElementById("type-income-btn");
    const select = document.getElementById("tx-category");

    if (!expBtn || !incBtn || !select) return;

    expBtn.classList.remove("active");
    incBtn.classList.remove("active");

    select.innerHTML = "";
    this.DEFAULT_CATEGORIES[type].forEach(c => {
      select.appendChild(new Option(c.label, c.id));
    });

    if (type === "expense") {
      expBtn.classList.add("active");
    } else {
      incBtn.classList.add("active");
    }
  }

  async saveTransaction(event) {
    event.preventDefault();

    const id = document.getElementById("tx-id").value;
    const amount = parseFloat(document.getElementById("tx-amount").value);
    const date = document.getElementById("tx-date").value;
    const category = document.getElementById("tx-category").value;
    const method = document.getElementById("tx-method").value;
    const note = document.getElementById("tx-note").value.trim();
    const type = document.querySelector('input[name="tx-type"]:checked').value;

    if (isNaN(amount) || amount <= 0) {
      alert("Por favor ingresa un monto válido mayor a 0.");
      return;
    }

    const txData = {
      type,
      amount,
      category,
      date,
      method,
      note
    };

    if (this.firebaseEnabled && this.user) {
      // 1. Guardar en Google Cloud Firebase Firestore
      const txId = id || "tx-" + Date.now();
      try {
        await this.db.collection("users").doc(this.user.uid)
          .collection("transactions").doc(txId).set({ id: txId, ...txData });
      } catch (err) {
        console.error("Error guardando en Firestore:", err);
      }
    } else {
      // 2. Guardar Localmente
      if (id) {
        const index = this.state.transactions.findIndex(t => t.id === id);
        if (index !== -1) {
          this.state.transactions[index] = { id, ...txData };
        }
      } else {
        const newTx = { id: "tx-" + Date.now(), ...txData };
        this.state.transactions.push(newTx);
      }
      this.saveState();
      this.render();
    }

    this.closeTransactionModal();

    if (this.state.activeTab === "transactions") {
      this.filterTransactions();
    }
  }

  deleteTransaction(id) {
    this.showConfirmDialog(
      "¿Eliminar transacción?",
      "Esta acción borrará el registro permanentemente de tu cuenta y balances acumulados.",
      async () => {
        if (this.firebaseEnabled && this.user) {
          try {
            await this.db.collection("users").doc(this.user.uid)
              .collection("transactions").doc(id).delete();
          } catch (err) {
            console.error("Error eliminando de Firestore:", err);
          }
        } else {
          this.state.transactions = this.state.transactions.filter(t => t.id !== id);
          this.saveState();
          this.render();
        }
        
        if (this.state.activeTab === "transactions") {
          this.filterTransactions();
        }
      }
    );
  }

  // ==========================================================================
  // Presupuestos CRUD
  // ==========================================================================
  openBudgetModal(categoryName = null) {
    const modal = document.getElementById("budget-modal");
    const form = document.getElementById("budget-form");

    form.reset();

    if (categoryName) {
      document.getElementById("budget-category").value = categoryName;
      document.getElementById("budget-limit").value = this.state.budgets[categoryName];
      document.getElementById("budget-category").disabled = true;
    } else {
      document.getElementById("budget-category").disabled = false;
    }

    modal.classList.add("active");
    setTimeout(() => {
      document.getElementById("budget-limit").focus();
    }, 100);
  }

  closeBudgetModal() {
    document.getElementById("budget-modal").classList.remove("active");
  }

  async saveBudget(event) {
    event.preventDefault();

    const category = document.getElementById("budget-category").value;
    const limit = parseFloat(document.getElementById("budget-limit").value);

    if (isNaN(limit) || limit <= 0) {
      alert("Por favor ingresa un límite válido mayor a 0.");
      return;
    }

    if (this.firebaseEnabled && this.user) {
      try {
        await this.db.collection("users").doc(this.user.uid)
          .collection("budgets").doc(category).set({ limit: limit });
      } catch (err) {
        console.error("Error al guardar presupuesto en Firestore:", err);
      }
    } else {
      this.state.budgets[category] = limit;
      this.saveState();
      this.render();
    }
    
    this.closeBudgetModal();
    if (this.state.activeTab === "budgets") {
      this.renderBudgetsList();
    }
  }

  deleteBudget(category) {
    this.showConfirmDialog(
      "¿Eliminar presupuesto?",
      `¿Deseas remover el límite de gasto mensual para ${category}?`,
      async () => {
        if (this.firebaseEnabled && this.user) {
          try {
            await this.db.collection("users").doc(this.user.uid)
              .collection("budgets").doc(category).delete();
          } catch (err) {
            console.error("Error eliminando presupuesto de Firestore:", err);
          }
        } else {
          delete this.state.budgets[category];
          this.saveState();
          this.render();
        }
        
        if (this.state.activeTab === "budgets") {
          this.renderBudgetsList();
        }
      }
    );
  }

  // ==========================================================================
  // Ajustes de Moneda e Import/Export
  // ==========================================================================
  changeCurrency(newCurrency) {
    this.state.currency = newCurrency;
    this.saveStateLocalOnly(); // La moneda siempre es una preferencia local por dispositivo
    this.render();
    
    if (this.state.activeTab === "budgets") {
      this.renderBudgetsList();
    } else if (this.state.activeTab === "transactions") {
      this.filterTransactions();
    }
  }

  exportDataJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.state, null, 2));
    const downloadAnchor = document.createElement("a");
    const today = new Date().toISOString().split("T")[0];
    
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `FinanFlow_Backup_${today}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  exportDataCSV() {
    if (this.state.transactions.length === 0) {
      alert("No hay transacciones para exportar.");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "ID,Tipo,Monto,Categoria,Fecha,Metodo de Pago,Nota\n";

    this.state.transactions.forEach(t => {
      const noteClean = (t.note || "").replace(/"/g, '""');
      csvContent += `"${t.id}","${t.type}",${t.amount},"${t.category}","${t.date}","${t.method}","${noteClean}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const downloadAnchor = document.createElement("a");
    const today = new Date().toISOString().split("T")[0];
    
    downloadAnchor.setAttribute("href", encodedUri);
    downloadAnchor.setAttribute("download", `FinanFlow_Excel_${today}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  importDataJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        
        if (Array.isArray(imported.transactions) && typeof imported.currency === "string") {
          
          if (this.firebaseEnabled && this.user) {
            // Importar en masa a Firestore
            const batch = this.db.batch();
            const userDocRef = this.db.collection("users").doc(this.user.uid);

            imported.transactions.forEach(t => {
              const docRef = userDocRef.collection("transactions").doc(t.id);
              batch.set(docRef, t);
            });

            if (imported.budgets) {
              Object.keys(imported.budgets).forEach(cat => {
                const docRef = userDocRef.collection("budgets").doc(cat);
                batch.set(docRef, { limit: imported.budgets[cat] });
              });
            }
            await batch.commit();
          } else {
            // Guardar localmente
            this.state.currency = imported.currency;
            this.state.transactions = imported.transactions;
            this.state.budgets = imported.budgets || {};
            this.saveStateLocalOnly();
          }

          alert("¡Respaldo importado con éxito!");
          window.location.reload();
        } else {
          alert("El archivo no tiene el formato de respaldo de FinanFlow.");
        }
      } catch (err) {
        alert("Error al leer el archivo.");
        console.error(err);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  confirmResetAll() {
    this.showConfirmDialog(
      "¿RESETEAR APLICACIÓN?",
      "¡ATENCIÓN! Se eliminarán de forma permanente todos los datos guardados. Si iniciaste sesión con Google, también se borrará tu historial en Google Cloud Firestore.",
      async () => {
        if (this.firebaseEnabled && this.user) {
          try {
            // Borrar transacciones del usuario de la nube
            const userDocRef = this.db.collection("users").doc(this.user.uid);
            
            const txDocs = await userDocRef.collection("transactions").get();
            const batch = this.db.batch();
            txDocs.forEach(doc => batch.delete(doc.ref));

            const budgetDocs = await userDocRef.collection("budgets").get();
            budgetDocs.forEach(doc => batch.delete(doc.ref));

            await batch.commit();
          } catch (err) {
            console.error("Error al resetear Firestore:", err);
          }
        }
        
        localStorage.clear();
        alert("Datos eliminados de fábrica.");
        window.location.reload();
      }
    );
  }

  // ==========================================================================
  // Modal de Confirmación
  // ==========================================================================
  showConfirmDialog(title, message, onConfirm) {
    const modal = document.getElementById("confirm-modal");
    const titleEl = document.getElementById("confirm-title");
    const msgEl = document.getElementById("confirm-message");
    const cancelBtn = document.getElementById("confirm-cancel-btn");
    const actionBtn = document.getElementById("confirm-action-btn");

    if (!modal || !titleEl || !msgEl || !cancelBtn || !actionBtn) return;

    titleEl.textContent = title;
    msgEl.textContent = message;

    const closeDialog = () => {
      modal.classList.remove("active");
    };

    cancelBtn.onclick = closeDialog;
    actionBtn.onclick = () => {
      onConfirm();
      closeDialog();
    };

    modal.classList.add("active");
  }
}

// Instanciar
const app = new FinanFlow();
window.app = app;
