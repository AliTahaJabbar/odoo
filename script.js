document.addEventListener("DOMContentLoaded", function () {
  // ============================================================
  // 1. التهيئة والربط (Initialization)
  // لمن: للمبرمج والمتصفح
  // لماذا: لضمان تحميل مكتبات Firebase قبل بدء الكود
  // ============================================================
  
  // فحص وجود Firebase لضمان عدم حدوث أخطاء قاتلة
  if (!window.firebase) {
      console.error("Firebase libraries not loaded yet!");
      document.getElementById('app-loader').innerHTML = '<p style="color:red">خطأ في تحميل المكتبات. تأكد من الإنترنت.</p>';
      return;
  }

  const auth = window.auth;
  const db = window.db;
  const {
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
    doc, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, collection, onSnapshot, query, orderBy
  } = window.firebase;

  // --- عناصر واجهة المستخدم الأساسية ---
  const themeToggleBtn = document.getElementById('theme-toggle');
  const body = document.body;
  
  const appLoader = document.getElementById('app-loader');
  const loginOverlay = document.getElementById("login-overlay");
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");

  const togglePassword = document.getElementById("toggle-password");
  const passwordInput = document.getElementById("login-password");

  const loginSubmitBtn = loginForm.querySelector(".login-submit-btn");
  const originalLoginBtnText = loginSubmitBtn.textContent;

  // عناصر التطبيق الرئيسية
  const mainWrapper = document.querySelector(".main-wrapper");
  const userRoleDisplay = document.getElementById("user-role-display");
  
  // المودال التنبيهي
  const alertModal = document.getElementById("alert-modal");
  const alertMessage = document.getElementById("alert-message");
  const alertCloseBtn = document.getElementById("alert-close-btn");
  
  // التنقل والقوائم
  const navLinks = document.querySelectorAll(".nav-link");
  const contentSections = document.querySelectorAll(".content-section");
  const mobileMenuBtn = document.querySelector(".mobile-menu-btn");
  const closeMenuBtn = document.querySelector(".close-menu");
  const mobileNav = document.querySelector(".mobile-nav");
  const overlay = document.querySelector(".overlay");
  const lightbox = document.querySelector(".image-lightbox");
  const closeLightbox = lightbox.querySelector(".close-lightbox");

  // عناصر لوحة التحكم (Admin Modal)
  const adminModal = document.getElementById('admin-modal');
  const adminModalForm = document.getElementById('admin-modal-form');
  const modalTitle = document.getElementById('modal-title');
  const modalFormFields = document.getElementById('modal-form-fields');
  const modalDocId = document.getElementById('modal-doc-id');
  const modalDataType = document.getElementById('modal-data-type');
  const modalError = document.getElementById('modal-error');
  const closeAdminModalBtn = document.querySelector('.close-modal-btn');

  // عناصر نافذة الصلاحيات
  const permissionsModal = document.getElementById('permissions-modal');
  const permissionsForm = document.getElementById('permissions-form');
  const closePermModalBtn = document.getElementById('close-perm-modal');
  const permUserName = document.getElementById('perm-user-name');
  const permUserUid = document.getElementById('perm-user-uid');


  // --- حالة التطبيق (State Management) ---
  let currentUser = null; 
  let userProfile = null; 
  let userProfileListener = null; 


  // ===========================================
  // 2. واجهة المستخدم التفاعلية (UI Interaction)
  // ===========================================

  // إغلاق القوائم المنسدلة عند النقر خارجها (Drop-down Logic)
  function closeAllOpenSelects(excludeContainer = null) {
      document.querySelectorAll('.custom-select-container.open').forEach(container => {
          if (container !== excludeContainer) {
              container.classList.remove('open');
          }
      });
  }

  document.addEventListener('click', function(e) {
      const valueTarget = e.target.closest('.custom-select-value');
      const optionTarget = e.target.closest('.custom-select-option');

      if (!valueTarget && !optionTarget) {
          closeAllOpenSelects();
          return;
      }

      if (valueTarget) {
          const container = valueTarget.closest('.custom-select-container');
          const isOpen = container.classList.contains('open');
          closeAllOpenSelects(container); 
          if (isOpen) container.classList.remove('open');
          else container.classList.add('open');
          return;
      }

      if (optionTarget) {
          const container = optionTarget.closest('.custom-select-container');
          if (!container) return; 

          const valueDisplay = container.querySelector('.custom-select-value');
          const newValue = optionTarget.dataset.value;
          const newText = optionTarget.textContent;
          const type = container.dataset.type;

          container.classList.remove('open');

          if (optionTarget.classList.contains('selected')) return; 
          
          valueDisplay.textContent = newText;
          container.querySelectorAll('.custom-select-option').forEach(opt => opt.classList.remove('selected'));
          optionTarget.classList.add('selected');

          const uid = container.dataset.uid;
          
          // التعامل المباشر مع تغيير الأدوار والحالة من الجدول
          if (type === 'role') {
              if (confirm(`هل أنت متأكد من تغيير وظيفة المستخدم إلى "${newText}"؟`)) {
                  updateUserRole(uid, newValue);
              } else {
                  loadAdminPanel(); // إعادة تحميل لإلغاء التغيير البصري
              }
          } else if (type === 'status') {
               const actionText = newValue === 'disabled' ? 'تعطيل' : 'تنشيط';
               if (confirm(`هل أنت متأكد من ${actionText} حساب هذا المستخدم؟`)) {
                  updateUserStatus(uid, newValue);
              } else {
                  loadAdminPanel();
              }
          }
      }
  });


  // --- الثيم (Dark/Light Mode) ---
  function applyTheme(theme) {
      body.classList.remove('dark-mode', 'light-mode');
      body.classList.add(theme + '-mode');
      
      const iconBtn = document.querySelector('#theme-toggle i');
      if (iconBtn) {
          iconBtn.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
      }
      localStorage.setItem('theme', theme);
  }
  
  themeToggleBtn.addEventListener('click', () => {
      const newTheme = body.classList.contains('dark-mode') ? 'light' : 'dark';
      applyTheme(newTheme);
  });
  const savedTheme = localStorage.getItem('theme') || 'light'; 
  applyTheme(savedTheme);


  // --- المساعدات (Helpers) ---
  function showCustomAlert(message) {
    alertMessage.textContent = message;
    alertModal.style.display = "flex";
  }
  alertCloseBtn.addEventListener("click", () => alertModal.style.display = "none");
  
  function openImageLightbox(imgSrc, title) {
    lightbox.querySelector("img").src = imgSrc;
    lightbox.querySelector(".lightbox-title").textContent = title;
    lightbox.classList.add("active");
  }
  closeLightbox.addEventListener("click", () => lightbox.classList.remove("active"));
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) lightbox.classList.remove("active"); });


  // ===========================================
  // 3. المصادقة والأمان (Authentication)
  // ===========================================

  if (togglePassword && passwordInput) {
      togglePassword.addEventListener("click", function () {
          const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
          passwordInput.setAttribute("type", type);
          this.classList.toggle("fa-eye");
          this.classList.toggle("fa-eye-slash");
      });
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const rememberMe = document.getElementById("remember-me").checked;
    
    loginError.textContent = "";
    loginSubmitBtn.disabled = true;
    loginSubmitBtn.textContent = "جاري التحقق...";

    try {
      const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged سيتولى الباقي
    } catch (error) {
      console.error("Login Error:", error);
      loginError.textContent = "خطأ: البريد أو كلمة المرور غير صحيحة.";
      loginSubmitBtn.disabled = false;
      loginSubmitBtn.textContent = originalLoginBtnText;
    }
  });

  function logout() {
    signOut(auth).catch(err => console.error(err));
  }
  
  // المراقب الذكي لحالة المستخدم (Observer)
  onAuthStateChanged(auth, (user) => {
    if (user) {
      const userDocRef = doc(db, "users", user.uid);

      if (userProfileListener) userProfileListener(); // إلغاء المستمع السابق إن وجد

      // الاستماع للتحديثات الحية على ملف المستخدم (للطرد الفوري عند الحظر)
      userProfileListener = onSnapshot(userDocRef, async (userDoc) => {
        if (!userDoc.exists()) {
            hideLoader();
            showCustomAlert("الحساب غير موجود.");
            signOut(auth); 
            return;
        }

        const newProfile = userDoc.data();
        if (newProfile.status === 'disabled') {
            hideLoader();
            showCustomAlert("تم تعطيل حسابك من قبل الإدارة.");
            signOut(auth); 
            return;
        }

        const isFirstLoad = (currentUser === null);
        currentUser = user;
        userProfile = newProfile;

        if (isFirstLoad) {
            await updateDoc(userDocRef, { lastLogin: new Date() });
            startApp(); 
        } else {
            // تحديث الواجهة حياً إذا تغيرت الصلاحيات
            setupUIForRole(); 
            if (userProfile.role === 'admin') loadAdminPanel(); 
        }

      }, (error) => {
          hideLoader();
          showCustomAlert("فشل الاتصال بقاعدة البيانات.");
          logout();
      });

    } else {
      // حالة الخروج
      if (userProfileListener) { userProfileListener(); userProfileListener = null; }
      
      currentUser = null;
      userProfile = null;
      document.body.classList.remove("logged-in");
      mainWrapper.style.display = "none";
      loginOverlay.style.display = "flex";
      hideLoader();
      
      loginSubmitBtn.disabled = false;
      loginSubmitBtn.textContent = originalLoginBtnText;
    }
  });

  function hideLoader() {
      if (appLoader) appLoader.style.display = 'none';
      document.documentElement.classList.remove("js-loading");
  }

  // ===========================================
  // 4. منطق التطبيق (Core Business Logic)
  // ===========================================

  function startApp() {
    document.body.classList.add("logged-in");
    loginOverlay.style.display = "none";
    mainWrapper.style.display = "block";
    hideLoader();

    setupUIForRole(); 
    initializeAppNavigation(); 
    loadAllDynamicData(); 
    setupAdminControls(); 
    setupProfilePage(); 
    setupGlobalEnterKey();
    setupPermissionsModal(); 
  }

  function setupUIForRole() {
    const role = userProfile.role;
    const permissions = userProfile.permissions || []; 
    let roleText = "";

    // قائمة بكل الأقسام (Apps)
    const sections = ['maps', 'offers', 'vlans', 'materials', 'entertainment-apps', 'ports', 'maintenance', 'admin-panel', 'profile'];
    
    // إخفاء الكل مبدئياً
    sections.forEach(section => {
        const appIcons = document.querySelectorAll(`.app-icon[data-section="${section}"]`);
        appIcons.forEach(el => el.style.display = 'none');

        const mobileLink = document.getElementById(`mobile-nav-${section}-link`);
        if (mobileLink) mobileLink.style.display = 'none';
        
        // روابط النافبار المخفية التي يعتمد عليها الكود
        const navLink = document.getElementById(`nav-${section}-link`);
        if (navLink) navLink.style.display = 'none';
    });

    document.querySelectorAll(".o_cp_buttons, #admin-add-user-btn").forEach(el => el.style.display = 'none');


    if (role === "admin") {
        roleText = "Administrator";
        // إظهار كل شيء للأدمن
        sections.forEach(section => {
            document.querySelectorAll(`.app-icon[data-section="${section}"]`).forEach(el => el.style.display = 'flex');
            const mLink = document.getElementById(`mobile-nav-${section}-link`);
            if (mLink) mLink.style.display = 'block';
        });
        
        document.querySelectorAll(".o_cp_buttons, #admin-add-user-btn").forEach(el => el.style.display = 'flex');
        loadAdminPanel();

    } else {
        // المستخدم العادي
        const roleMap = { 'teamLeader': 'Team Leader', 'follower': 'Follower', 'marketing': 'Marketing', 'sales': 'Sales' };
        roleText = roleMap[role] || "User";

        // إظهار الملف الشخصي دائماً
        document.querySelectorAll(`.app-icon[data-section="profile"]`).forEach(el => el.style.display = 'flex');
        const mLinkProfile = document.getElementById(`mobile-nav-profile-link`);
        if (mLinkProfile) mLinkProfile.style.display = 'block';

        // إظهار التطبيقات المصرح بها فقط
        permissions.forEach(perm => {
            document.querySelectorAll(`.app-icon[data-section="${perm}"]`).forEach(el => el.style.display = 'flex');
            const mLink = document.getElementById(`mobile-nav-${perm}-link`);
            if (mLink) mLink.style.display = 'block';
        });
    }

    userRoleDisplay.textContent = `${userProfile.name || userProfile.email}`; 
    
    // تعبئة قائمة الموبايل بمعلومات المستخدم
    const mobileUserInfo = document.getElementById("mobile-user-info");
    mobileUserInfo.innerHTML = `
      <div style="padding: 15px; border-top: 1px solid var(--border-color);">
         <div style="font-weight:bold;">${userProfile.name}</div>
         <div style="color:var(--text-muted); font-size:0.9rem;">${roleText}</div>
         <button class="logout-btn" style="color:red; margin-top:10px; width:100%; text-align:right;">
            <i class="fas fa-sign-out-alt"></i> تسجيل الخروج
         </button>
      </div>
    `;
    
    document.querySelectorAll(".logout-btn").forEach((btn) => btn.addEventListener("click", logout));
  }

  // التنقل (Router Logic Sim)
  function initializeAppNavigation() {
      navLinks.forEach((link) => {
        link.addEventListener("click", function (e) {
          e.preventDefault();
          
          if (this.classList.contains('app-drawer-toggle')) {
              showSection('home');
              return;
          }

          const targetSectionId = this.getAttribute("data-section");
          if (!targetSectionId) return;

          // التحقق من الصلاحية قبل الانتقال
          if (userProfile.role !== 'admin') {
             if (targetSectionId === "admin-panel") {
                showCustomAlert("وصول مرفوض: للإداريين فقط.");
                return;
             }
             const commonSections = ['home', 'contact', 'profile'];
             const permissions = userProfile.permissions || [];
             if (!commonSections.includes(targetSectionId) && !permissions.includes(targetSectionId)) {
                 showCustomAlert("ليس لديك صلاحية للوصول لهذا التطبيق.");
                 return;
             }
          }
          
          showSection(targetSectionId);
        });
      });

      // الموبايل
      mobileMenuBtn.addEventListener("click", () => { mobileNav.classList.add("active"); overlay.classList.add("active"); });
      const closeMobileMenu = () => { mobileNav.classList.remove("active"); overlay.classList.remove("active"); };
      closeMenuBtn.addEventListener("click", closeMobileMenu);
      overlay.addEventListener("click", closeMobileMenu);
      document.querySelectorAll('.mobile-nav-links a').forEach(link => link.addEventListener('click', closeMobileMenu));
  }

  function showSection(sectionId) {
      contentSections.forEach((section) => section.classList.remove("active"));
      const target = document.getElementById(sectionId);
      if (target) {
          target.classList.add("active");
          window.scrollTo(0, 0);
      }
  }

  function setupGlobalEnterKey() {
      function addEnterListener(inputId, buttonId) {
          const input = document.getElementById(inputId);
          const button = document.getElementById(buttonId);
          if (input && button) {
              input.addEventListener("keypress", function(e) {
                  if (e.key === "Enter") { e.preventDefault(); button.click(); }
              });
          }
      }
      addEnterListener("areaNumber", "showOffersBtn");
      addEnterListener("vlanInput", "showVlanBtn");
      addEnterListener("portSearchInput", "searchPortsBtn");
  }


  // ===========================================
  // 5. جلب البيانات (Data Fetching & Rendering)
  // ===========================================

  function loadAllDynamicData() {
    initMaps();
    initMaterials();
    initMaintenance();
    initStickers();
    setupVLANs(); 
    setupPorts();
    setupOffers(); 
    initEntertainmentApps(); 
  }

  // --- الخرائط ---
  function initMaps() {
    const mapsContainer = document.querySelector(".maps-container");
    const mapSearchInput = document.getElementById("mapSearchInput");
    let allMaps = []; 

    onSnapshot(query(collection(db, "maps"), orderBy("order", "asc")), (snapshot) => {
      allMaps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      displayMaps(allMaps);
    });

    function displayMaps(mapsToDisplay) {
      mapsContainer.innerHTML = "";
      if (mapsToDisplay.length === 0) {
        mapsContainer.innerHTML = `<p class="text-muted text-center w-100">لا توجد خرائط.</p>`;
        return;
      }
      mapsToDisplay.forEach((map) => {
        const mapItem = document.createElement("div");
        mapItem.className = "map-item odoo-card"; 
        mapItem.innerHTML = `
          <a href="${map.link}" target="_blank" style="text-decoration:none; color:inherit; width:100%; display:flex; flex-direction:column; align-items:center;">
            <div style="font-size:2.5rem; color:var(--app-maps); margin-bottom:10px;"><i class="fas fa-map-marked-alt"></i></div>
            <div class="map-name">${map.name}</div>
          </a>
          ${userProfile.role === 'admin' ? `
          <div class="admin-item-controls">
            <button class="admin-edit-btn" data-id="${map.id}" data-name="${map.name}" data-link="${map.link}" data-order="${map.order ?? 0}">تعديل</button>
            <button class="admin-delete-btn" data-id="${map.id}">حذف</button>
          </div>` : ''}
        `;
        mapsContainer.appendChild(mapItem);
      });
      if (userProfile.role === 'admin') setupMapAdminButtons(mapsContainer);
    }

    mapSearchInput.addEventListener("input", function () {
      const term = this.value.trim().toLowerCase();
      displayMaps(allMaps.filter((map) => map.name.toLowerCase().includes(term)));
    });
  }
  
  // --- العروض ---
  function setupOffers() {
      const showOffersBtn = document.getElementById("showOffersBtn");
      const areaNumberInput = document.getElementById("areaNumber");
      const offersResults = document.getElementById("offersResults");

      showOffersBtn.addEventListener("click", async () => {
         const areaNameOrNumber = areaNumberInput.value.trim();
         if (!areaNameOrNumber) { showCustomAlert("الرجاء إدخال رقم المنطقة."); return; }
         
         offersResults.innerHTML = '<div class="odoo-sheet text-center">جاري البحث...</div>';
         offersResults.classList.add("active");

         try {
            const offerDoc = await getDoc(doc(db, "offers", areaNameOrNumber));
            if (!offerDoc.exists()) {
                offersResults.innerHTML = `<div class="odoo-sheet text-center text-muted">لا توجد عروض للمنطقة ${areaNameOrNumber}</div>`;
                return;
            }

            const offerData = offerDoc.data();
            let tableHtml = '';
            
            if (offerData.categoryHeaders && offerData.durationRows) {
                const headers = ['المدة', ...offerData.categoryHeaders];
                const headerHtml = headers.map(h => `<th>${h}</th>`).join('');
                const rowsHtml = offerData.durationRows.map(row => {
                    let rowTds = `<td><strong>${row.durationName}</strong></td>`;
                    const prices = row.prices || [];
                    for (let i = 0; i < offerData.categoryHeaders.length; i++) { rowTds += `<td>${prices[i] || '-'}</td>`; }
                    return `<tr>${rowTds}</tr>`;
                }).join('');

                tableHtml = `<div class="offer-table-container"><table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
            } else { tableHtml = '<p>تنسيق البيانات قديم.</p>'; }

            offersResults.innerHTML = `
                <div class="odoo-sheet">
                    <h3 style="border-bottom:1px solid #eee; padding-bottom:10px; color:var(--o-brand-primary);">${offerData.title}</h3>
                    ${tableHtml}
                    ${offerData.note ? `<div style="margin-top:20px; padding:10px; background:#fff3cd; color:#856404; border-radius:4px;">${offerData.note}</div>` : ''}
                    ${userProfile.role === 'admin' ? `<div style="margin-top:20px; text-align:left;">
                        <button class="btn btn-primary admin-edit-btn" data-id="${offerDoc.id}"><i class="fas fa-edit"></i> تعديل</button>
                        <button class="btn btn-secondary admin-delete-btn" data-id="${offerDoc.id}"><i class="fas fa-trash"></i> حذف</button>
                    </div>` : ''}
                </div>`;
                
             if (userProfile.role === 'admin') {
                 offersResults.querySelector('.admin-edit-btn').addEventListener('click', () => openAdminModal('offer', { id: offerDoc.id, ...offerData }));
                 offersResults.querySelector('.admin-delete-btn').addEventListener('click', async () => { if (confirm('حذف؟')) { await deleteDoc(doc(db, "offers", offerDoc.id)); offersResults.innerHTML = ''; } });
             }
         } catch (error) { console.error(error); offersResults.innerHTML = `<div class="odoo-sheet">حدث خطأ.</div>`; }
      });
  }

  // --- الفيلانات ---
  function setupVLANs() {
    const showVlanBtn = document.getElementById("showVlanBtn");
    const vlanInput = document.getElementById("vlanInput");
    const vlanResult = document.getElementById("vlanResult");
    
    showVlanBtn.addEventListener("click", async () => {
        const area = vlanInput.value.trim();
        if (!area) return;
        vlanResult.innerHTML = "جاري البحث...";
        try {
            const vlanDoc = await getDoc(doc(db, "vlans", area));
            if (vlanDoc.exists()) {
                const data = vlanDoc.data();
                vlanResult.innerHTML = `
                    <div style="font-size:1.5rem; font-weight:bold; color:var(--app-vlans); text-align:center;">VLAN: ${data.vlan}</div>
                    ${userProfile.role === 'admin' ? `<div class="admin-item-controls" style="justify-content:center; margin-top:15px;">
                        <button class="admin-edit-btn" data-id="${vlanDoc.id}" data-vlan="${data.vlan}" data-order="${data.order ?? 0}">تعديل</button>
                        <button class="admin-delete-btn" data-id="${vlanDoc.id}">حذف</button>
                    </div>` : ''}
                `;
                if (userProfile.role === 'admin') {
                     vlanResult.querySelector('.admin-edit-btn').addEventListener('click', (e) => openAdminModal('vlan', { id: e.currentTarget.dataset.id, vlan: e.currentTarget.dataset.vlan, order: e.currentTarget.dataset.order }));
                     vlanResult.querySelector('.admin-delete-btn').addEventListener('click', async (e) => { if (confirm('حذف؟')) { await deleteDoc(doc(db, "vlans", e.currentTarget.dataset.id)); vlanResult.innerHTML = ""; } });
                }
            } else { vlanResult.innerHTML = "<p style='text-align:center'>غير موجود.</p>"; }
        } catch (error) { vlanResult.innerHTML = "خطأ."; }
    });
  }

  // --- المواد ---
  function initMaterials() {
    const materialsGrid = document.querySelector(".materials-grid");
    const categoryBtns = document.querySelectorAll(".category-btn");
    let allMaterials = [];
    let currentCategory = 'routers'; 

    onSnapshot(query(collection(db, "materials"), orderBy("order", "asc")), (snapshot) => {
        allMaterials = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        displayMaterials(currentCategory); 
    });

    function displayMaterials(category) {
      materialsGrid.innerHTML = "";
      const items = allMaterials.filter(item => item.category === category);
      if (items.length === 0) { materialsGrid.innerHTML = `<p class="text-muted text-center w-100">لا توجد مواد.</p>`; return; }

      items.forEach((item) => {
        const card = document.createElement("div");
        card.className = "material-card odoo-card"; 
        card.innerHTML = `
          <div class="material-img" style="cursor:pointer;">
              <img src="${item.image}" style="width:100%; height:150px; object-fit:contain;" onerror="this.src='https://placehold.co/400x200?text=No+Image'">
          </div>
          <div class="material-content">
              <h3>${item.name}</h3>
              <div style="color:var(--o-brand-secondary); font-weight:bold; margin:5px 0;">${item.price}</div>
              <ul class="material-specs" style="list-style:none; padding:0;">${(item.specs || []).map(s => `<li>• ${s}</li>`).join("")}</ul>
          </div>
          ${userProfile.role === 'admin' ? `<div class="admin-item-controls">
            <button class="admin-edit-btn" data-id="${item.id}">تعديل</button>
            <button class="admin-delete-btn" data-id="${item.id}">حذف</button>
          </div>` : ''}
        `;
        card.querySelector(".material-img").addEventListener("click", () => openImageLightbox(item.image, item.name));
        materialsGrid.appendChild(card);
      });
      if (userProfile.role === 'admin') {
           materialsGrid.querySelectorAll('.admin-edit-btn').forEach(btn => btn.addEventListener('click', (e) => openAdminModal('material', allMaterials.find(m => m.id === e.currentTarget.dataset.id))));
           materialsGrid.querySelectorAll('.admin-delete-btn').forEach(btn => btn.addEventListener('click', (e) => { if(confirm('حذف؟')) deleteDoc(doc(db, "materials", e.currentTarget.dataset.id)); }));
      }
    }

    categoryBtns.forEach((btn) => {
      btn.addEventListener("click", function () {
        categoryBtns.forEach((b) => { b.classList.remove("active", "btn-primary"); b.classList.add("btn-secondary"); });
        this.classList.remove("btn-secondary"); this.classList.add("active", "btn-primary");
        currentCategory = this.getAttribute("data-category");
        displayMaterials(currentCategory);
      });
    });
  }

  // --- المنافذ ---
  function setupPorts() {
      const searchInput = document.getElementById("portSearchInput");
      const searchBtn = document.getElementById("searchPortsBtn");
      const tableBody = document.getElementById("portsTableBody");
      const resultsContainer = document.getElementById("portsResults");
      let allPorts = [];

      if (userProfile.role === 'admin') document.querySelectorAll('#ports .admin-col').forEach(col => col.style.display = 'table-cell');

      onSnapshot(query(collection(db, "ports"), orderBy("order", "asc")), (snapshot) => {
          allPorts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      });

      function displayPorts(portsToDisplay) {
          tableBody.innerHTML = "";
          if (portsToDisplay.length === 0) { tableBody.innerHTML = `<tr><td colspan="7" class="text-center">لا توجد نتائج.</td></tr>`; return; }
          
          portsToDisplay.forEach(port => {
              const row = document.createElement('tr');
              row.innerHTML = `
                  <td>${port.areaName}</td> <td>${port.zone || '-'}</td> <td>${port.portName}</td> <td>${port.landmark || '-'}</td> <td>${port.coordinates || '-'}</td>
                  <td>${port.coordinates ? `<a href="http://maps.google.com/?q=${port.coordinates}" target="_blank" class="btn btn-secondary btn-sm">Map</a>` : '-'}</td>
                  ${userProfile.role === 'admin' ? `<td class="admin-col"><div class="admin-item-controls" style="border:none; margin:0; padding:0;">
                        <button class="admin-edit-btn" data-id="${port.id}"><i class="fas fa-edit"></i></button>
                        <button class="admin-delete-btn" data-id="${port.id}"><i class="fas fa-trash"></i></button>
                  </div></td>` : '<td class="admin-col" style="display: none;"></td>'}
              `;
              tableBody.appendChild(row);
              if (userProfile.role === 'admin') {
                  row.querySelector('.admin-edit-btn').addEventListener('click', () => openAdminModal('port', allPorts.find(p => p.id === port.id)));
                  row.querySelector('.admin-delete-btn').addEventListener('click', async () => { if (confirm('حذف؟')) await deleteDoc(doc(db, "ports", port.id)); });
              }
          });
      }
      searchBtn.addEventListener('click', () => {
          const term = searchInput.value.trim().toLowerCase();
          displayPorts(!term ? allPorts : allPorts.filter(p => p.areaName.toLowerCase().includes(term) || p.zone?.toLowerCase().includes(term)));
          resultsContainer.style.display = 'block';
      });
  }

  // --- الصيانة والستيكرات ---
  function initMaintenance() {
    const container = document.querySelector("#maintenance .maintenance-container");
    onSnapshot(query(collection(db, "maintenanceNumbers"), orderBy("order", "asc")), (snapshot) => {
        container.innerHTML = "";
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const card = document.createElement("div");
            card.className = "maintenance-card odoo-card";
            card.innerHTML = `<h3>${data.area}</h3><p style="font-size:1.2rem; color:var(--o-brand-secondary); font-weight:bold;">${data.phone}</p>
                ${userProfile.role === 'admin' ? `<div class="admin-item-controls">
                    <button class="admin-edit-btn" data-id="${doc.id}" data-area="${data.area}" data-phone="${data.phone}" data-order="${data.order ?? 0}">تعديل</button>
                    <button class="admin-delete-btn" data-id="${doc.id}">حذف</button>
                </div>` : ''}`;
            container.appendChild(card);
        });
        if (userProfile.role === 'admin') {
            container.querySelectorAll('.admin-edit-btn').forEach(btn => btn.addEventListener('click', (e) => openAdminModal('maintenance', { id: e.currentTarget.dataset.id, area: e.currentTarget.dataset.area, phone: e.currentTarget.dataset.phone, order: e.currentTarget.dataset.order })));
            container.querySelectorAll('.admin-delete-btn').forEach(btn => btn.addEventListener('click', (e) => { if(confirm('حذف؟')) deleteDoc(doc(db, "maintenanceNumbers", e.currentTarget.dataset.id)); }));
        }
    });
  }
  
  function initStickers() {
      const container = document.querySelector("#maintenance .stickers-container");
      onSnapshot(query(collection(db, "stickers"), orderBy("order", "asc")), (snapshot) => {
          container.innerHTML = "";
          snapshot.docs.forEach(doc => {
              const data = doc.data();
              const item = document.createElement("div");
              item.className = "sticker-item odoo-card";
              item.innerHTML = `<img src="${data.thumb}" style="width:80px; height:80px; border-radius:50%; object-fit:cover; margin:0 auto 10px; cursor:pointer;">
                  <p style="text-align:center; font-weight:bold;">${data.name}</p>
                  ${userProfile.role === 'admin' ? `<div class="admin-item-controls">
                      <button class="admin-edit-btn" data-id="${doc.id}" data-name="${data.name}" data-thumb="${data.thumb}" data-full="${data.full}" data-order="${data.order??0}">تعديل</button>
                      <button class="admin-delete-btn" data-id="${doc.id}">حذف</button>
                  </div>` : ''}`;
              item.querySelector("img").addEventListener("click", () => openImageLightbox(data.full, data.name));
              container.appendChild(item);
          });
          if (userProfile.role === 'admin') {
             container.querySelectorAll('.admin-edit-btn').forEach(btn => btn.addEventListener('click', (e) => { const d = e.currentTarget.dataset; openAdminModal('sticker', { id: d.id, name: d.name, thumb: d.thumb, full: d.full, order: d.order }); }));
             container.querySelectorAll('.admin-delete-btn').forEach(btn => btn.addEventListener('click', (e) => { if(confirm('حذف؟')) deleteDoc(doc(db, "stickers", e.currentTarget.dataset.id)); }));
          }
      });
  }

  // --- التطبيقات ---
  function initEntertainmentApps() {
    const appsGrid = document.querySelector("#entertainment-apps .apps-grid");
    onSnapshot(query(collection(db, "entertainmentApps"), orderBy("order", "asc")), (snapshot) => {
      appsGrid.innerHTML = ""; 
      snapshot.docs.forEach(doc => {
        const app = doc.data();
        const card = document.createElement('div');
        card.className = 'app-card odoo-card';
        card.innerHTML = `
          <div class="app-icon-container"><img src="${app.image}" style="width:100%; height:100%; object-fit:cover;"></div>
          <h3 style="text-align:center;">${app.name}</h3>
          <div class="app-desc" style="text-align:center; margin-bottom:10px;">${app.description || ''}</div>
          ${app.code ? `<div style="background:#eee; padding:5px; text-align:center; border-radius:4px; margin-bottom:10px; font-family:monospace;">الكود: ${app.code}</div>` : ''}
          <a href="${app.directUrl || '#'}" target="_blank" class="btn btn-primary w-100 justify-content-center">تحميل / فتح</a>
          ${userProfile.role === 'admin' ? `<div class="admin-item-controls">
             <button class="admin-edit-btn" data-id="${doc.id}">تعديل</button>
             <button class="admin-delete-btn" data-id="${doc.id}">حذف</button>
          </div>` : ''}
        `;
        appsGrid.appendChild(card);
        if (userProfile.role === 'admin') {
            card.querySelector('.admin-edit-btn').addEventListener('click', () => openAdminModal('entertainmentApp', { id: doc.id, ...app }));
            card.querySelector('.admin-delete-btn').addEventListener('click', async () => { if (confirm('حذف؟')) await deleteDoc(doc(db, "entertainmentApps", doc.id)); });
        }
      });
    });
  }
  
  // --- الملف الشخصي ---
  function setupProfilePage() {
      if (currentUser && userProfile) {
          document.getElementById('profile-name').value = userProfile.name || '';
          document.getElementById('profile-email').value = currentUser.email || '';
          document.getElementById('profile-phone').value = userProfile.phone || '';
          document.getElementById('profile-birthdate').value = userProfile.birthdate || '';
      }
      document.getElementById("profile-details-form").addEventListener('submit', async (e) => {
          e.preventDefault();
          try {
              await updateDoc(doc(db, "users", currentUser.uid), {
                  phone: document.getElementById('profile-phone').value, birthdate: document.getElementById('profile-birthdate').value
              });
              document.getElementById('profile-details-success').textContent = "تم الحفظ.";
          } catch (error) { document.getElementById('profile-details-error').textContent = "فشل الحفظ."; }
      });
      document.getElementById("password-change-form").addEventListener('submit', async (e) => {
          e.preventDefault();
          const curPass = document.getElementById('profile-current-password').value;
          const newPass = document.getElementById('profile-new-password').value;
          if (newPass !== document.getElementById('profile-confirm-password').value) { document.getElementById('password-change-error').textContent = "غير متطابقة."; return; }
          try {
              await reauthenticateWithCredential(currentUser, EmailAuthProvider.credential(currentUser.email, curPass));
              await updatePassword(currentUser, newPass);
              document.getElementById('password-change-success').textContent = "تم التغيير."; e.target.reset();
          } catch (error) { document.getElementById('password-change-error').textContent = "كلمة المرور الحالية خطأ."; }
      });
  }


  // ===========================================
  // 6. لوحة الإدارة (Admin Controls)
  // ===========================================

  async function loadAdminPanel() {
    const usersTableBody = document.getElementById("admin-users-table-body");
    if (!usersTableBody) return; 
    usersTableBody.innerHTML = '<tr><td colspan="9">جاري التحميل...</td></tr>';
    
    const usersSnapshot = await getDocs(query(collection(db, "users"), orderBy("name", "asc")));
    usersTableBody.innerHTML = "";
    
    usersSnapshot.docs.forEach(docSnap => {
        const user = docSnap.data();
        if (user.uid === currentUser.uid) return; 

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${user.name}</td> <td>${user.email}</td> <td>${user.phone || '-'}</td> <td>${user.birthdate || '-'}</td>
            <td>
                <div class="custom-select-container" data-type="role" data-uid="${user.uid}">
                    <div class="custom-select-value" style="font-size:0.85rem; padding:4px;">${user.role} <i class="fas fa-caret-down"></i></div>
                    <div class="custom-select-options">
                        <div class="custom-select-option" data-value="teamLeader">Team Leader</div>
                        <div class="custom-select-option" data-value="follower">Follower</div>
                        <div class="custom-select-option" data-value="marketing">Marketing</div>
                        <div class="custom-select-option" data-value="sales">Sales</div>
                        <div class="custom-select-option" data-value="admin">Admin</div>
                    </div>
                </div>
            </td>
            <td>
                 <div class="custom-select-container" data-type="status" data-uid="${user.uid}">
                    <div class="custom-select-value" style="color:${user.status==='disabled'?'red':'green'}; font-size:0.85rem; padding:4px;">${user.status!=='disabled'?'Active':'Disabled'}</div>
                    <div class="custom-select-options"><div class="custom-select-option" data-value="active">Active</div><div class="custom-select-option" data-value="disabled">Disabled</div></div>
                </div>
            </td>
            <td><button class="btn btn-secondary permissions-btn p-1" data-uid="${user.uid}" data-name="${user.name}">صلاحيات</button></td>
            <td><button class="admin-edit-btn w-100" data-uid="${user.uid}">تعديل</button></td>
            <td><button class="admin-delete-btn delete-user-btn w-100" data-uid="${user.uid}">حذف</button></td>
        `;
        usersTableBody.appendChild(row);
        row.querySelector('.admin-edit-btn').addEventListener('click', () => openAdminModal('user', { id: user.uid, ...user }));
        row.querySelector('.delete-user-btn').addEventListener('click', () => handleDeleteUser(user.uid));
        row.querySelector('.permissions-btn').addEventListener('click', () => openPermissionsModal(user.uid, user.name, user.permissions || []));
    });
  }

  async function handleDeleteUser(uid) { if (confirm(`حذف المستخدم نهائياً؟`)) { await deleteDoc(doc(db, "users", uid)); loadAdminPanel(); } }
  async function updateUserRole(uid, newRole) { await updateDoc(doc(db, "users", uid), { role: newRole }); loadAdminPanel(); }
  async function updateUserStatus(uid, newStatus) { await updateDoc(doc(db, "users", uid), { status: newStatus }); loadAdminPanel(); }

  function setupPermissionsModal() {
      closePermModalBtn.addEventListener('click', () => permissionsModal.style.display = 'none');
      permissionsForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const uid = permUserUid.value;
          const selected = Array.from(permissionsForm.querySelectorAll('input:checked')).map(cb => cb.value);
          await updateDoc(doc(db, "users", uid), { permissions: selected });
          permissionsModal.style.display = 'none'; showCustomAlert("تم تحديث الصلاحيات."); loadAdminPanel(); 
      });
  }

  function openPermissionsModal(uid, name, currentPermissions) {
      permUserName.textContent = `المستخدم: ${name}`;
      permUserUid.value = uid;
      permissionsForm.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
      if (currentPermissions) currentPermissions.forEach(perm => { const cb = document.querySelector(`input[value="${perm}"]`); if (cb) cb.checked = true; });
      permissionsModal.style.display = 'flex';
  }

  // --- إدارة المودال (Core CRUD Modal) ---
  function setupAdminControls() {
      document.querySelectorAll('.admin-add-btn').forEach(btn => {
          btn.addEventListener('click', (e) => { const type = e.currentTarget.dataset.type; if (type) openAdminModal(type); });
      });
      const addUserBtn = document.getElementById('admin-add-user-btn');
      if (addUserBtn) addUserBtn.addEventListener('click', () => openAdminModal('new-user'));
      closeAdminModalBtn.addEventListener('click', () => adminModal.style.display = 'none');
      adminModalForm.addEventListener('submit', handleAdminFormSubmit);
  }
  
  function openAdminModal(type, data = null) {
      adminModalForm.reset();
      modalError.textContent = '';
      modalDataType.value = type;
      modalDocId.value = data ? data.id : '';
      modalFormFields.innerHTML = ''; 
      
      const orderField = `<div class="form-group"><label>الترتيب</label><input type="number" id="modal-order" class="form-control" value="${data?.order ?? 0}"></div>`;
      
      let html = '';
      if (type === 'map') {
          modalTitle.textContent = data ? 'تعديل خريطة' : 'إضافة خريطة';
          html = `<div class="form-group"><label>الاسم</label><input type="text" id="modal-map-name" class="form-control" value="${data?.name ?? ''}" required></div>
                  <div class="form-group"><label>الرابط</label><input type="url" id="modal-map-link" class="form-control" value="${data?.link ?? ''}" required></div>` + orderField;
      } else if (type === 'maintenance') {
          modalTitle.textContent = 'بيانات صيانة';
           html = `<div class="form-group"><label>المنطقة</label><input type="text" id="modal-maint-area" class="form-control" value="${data?.area ?? ''}" required></div>
                   <div class="form-group"><label>الهاتف</label><input type="tel" id="modal-maint-phone" class="form-control" value="${data?.phone ?? ''}" required></div>` + orderField;
      } else if (type === 'material') {
           modalTitle.textContent = 'بيانات مادة';
           const specs = data?.specs ? data.specs.join('\n') : '';
           html = `<div class="form-group"><label>الاسم</label><input type="text" id="modal-mat-name" class="form-control" value="${data?.name ?? ''}" required></div>
                   <div class="form-group"><label>السعر</label><input type="text" id="modal-mat-price" class="form-control" value="${data?.price ?? ''}"></div>
                   <div class="form-group"><label>الصورة URL</label><input type="url" id="modal-mat-image" class="form-control" value="${data?.image ?? ''}"></div>
                   <div class="form-group"><label>الفئة</label>
                      <select id="modal-mat-category" class="form-control">
                          <option value="routers" ${data?.category === 'routers' ? 'selected' : ''}>راوترات</option>
                          <option value="onu" ${data?.category === 'onu' ? 'selected' : ''}>ONU</option>
                          <option value="ont" ${data?.category === 'ont' ? 'selected' : ''}>ONT</option>
                          <option value="other" ${data?.category === 'other' ? 'selected' : ''}>أخرى</option>
                      </select></div>
                   <div class="form-group"><label>المواصفات</label><textarea id="modal-mat-specs" class="form-control">${specs}</textarea></div>` + orderField;
      } else if (type === 'offer') {
          modalTitle.textContent = 'بيانات عرض';
          const defaultData = JSON.stringify({ categoryHeaders: ["فئة 1"], durationRows: [{ durationName: "شهر", prices: ["1000"] }] }, null, 2);
          const currentData = (data && data.categoryHeaders) ? JSON.stringify({categoryHeaders: data.categoryHeaders, durationRows: data.durationRows}, null, 2) : defaultData;
          
          html = `<div class="form-group"><label>معرف المنطقة</label><input type="text" id="modal-offer-id" class="form-control" value="${data?.id ?? ''}" ${data ? 'disabled' : 'required'}></div>
                  <div class="form-group"><label>العنوان</label><input type="text" id="modal-offer-title" class="form-control" value="${data?.title ?? ''}" required></div>
                  <div class="form-group"><label>ملاحظة</label><textarea id="modal-offer-note" class="form-control">${data?.note ?? ''}</textarea></div>
                  <div class="form-group"><label>JSON البيانات</label><textarea id="modal-offer-data" class="form-control" style="direction:ltr; height:150px;">${currentData}</textarea></div>`;
      } else if (type === 'vlan') {
          modalTitle.textContent = 'بيانات VLAN';
          html = `<div class="form-group"><label>معرف المنطقة</label><input type="text" id="modal-vlan-id" class="form-control" value="${data?.id ?? ''}" ${data ? 'disabled' : 'required'}></div>
                  <div class="form-group"><label>قيمة VLAN</label><input type="text" id="modal-vlan-value" class="form-control" value="${data?.vlan ?? ''}" required></div>` + orderField;
      } else if (type === 'port') {
          modalTitle.textContent = 'بيانات منفذ';
          html = `<div class="form-group"><label>المنطقة</label><input type="text" id="modal-port-areaName" class="form-control" value="${data?.areaName ?? ''}" required></div>
                  <div class="form-group"><label>الزون</label><input type="text" id="modal-port-zone" class="form-control" value="${data?.zone ?? ''}"></div>
                  <div class="form-group"><label>المنفذ</label><input type="text" id="modal-port-portName" class="form-control" value="${data?.portName ?? ''}" required></div>
                  <div class="form-group"><label>نقطة دالة</label><input type="text" id="modal-post-landmark" class="form-control" value="${data?.landmark ?? ''}"></div>
                  <div class="form-group"><label>إحداثيات</label><input type="text" id="modal-port-coordinates" class="form-control" value="${data?.coordinates ?? ''}"></div>` + orderField;
      } else if (type === 'sticker') {
          modalTitle.textContent = 'بيانات ستيكر';
          html = `<div class="form-group"><label>الاسم</label><input type="text" id="modal-sticker-name" class="form-control" value="${data?.name ?? ''}"></div>
                  <div class="form-group"><label>مصغرة URL</label><input type="url" id="modal-sticker-thumb" class="form-control" value="${data?.thumb ?? ''}"></div>
                  <div class="form-group"><label>كاملة URL</label><input type="url" id="modal-sticker-full" class="form-control" value="${data?.full ?? ''}"></div>` + orderField;
      } else if (type === 'entertainmentApp') {
          modalTitle.textContent = 'تطبيق ترفيهي';
          html = `<div class="form-group"><label>الاسم</label><input type="text" id="modal-app-name" class="form-control" value="${data?.name ?? ''}" required></div>
                  <div class="form-group"><label>الصورة</label><input type="url" id="modal-app-image" class="form-control" value="${data?.image ?? ''}"></div>
                  <div class="form-group"><label>الوصف</label><textarea id="modal-app-desc" class="form-control">${data?.description ?? ''}</textarea></div>
                  <div class="form-group"><label>الكود</label><input type="text" id="modal-app-code" class="form-control" value="${data?.code ?? ''}"></div>
                  <div class="form-group"><label>الرابط</label><input type="url" id="modal-app-direct" class="form-control" value="${data?.directUrl ?? ''}"></div>` + orderField;
      } else if (type === 'user' || type === 'new-user') {
          // **********************************************************
          // الإصلاح الجوهري: استخدام معرفات فريدة للمستخدم الجديد
          // **********************************************************
          modalTitle.textContent = type === 'user' ? 'تعديل مستخدم' : 'مستخدم جديد';
          const isNew = type === 'new-user';
          html = `<div class="form-group"><label>الاسم</label><input type="text" id="modal-user-name" class="form-control" value="${data?.name ?? ''}" required></div>
                  <div class="form-group"><label>البريد</label><input type="email" id="${isNew ? 'modal-new-email' : 'modal-user-email'}" class="form-control" value="${data?.email ?? ''}" ${isNew?'required':'disabled'}></div>
                  ${isNew ? `<div class="form-group"><label>كلمة المرور</label><input type="password" id="modal-new-password" class="form-control" required minlength="6"></div>
                             <div class="form-group"><label>الدور</label><select id="modal-new-role" class="form-control"><option value="teamLeader">Team Leader</option><option value="follower">Follower</option><option value="marketing">Marketing</option><option value="sales">Sales</option></select></div>` : ''}
                  <div class="form-group"><label>الهاتف</label><input type="tel" id="modal-user-phone" class="form-control" value="${data?.phone ?? ''}"></div>
                  <div class="form-group"><label>الميلاد</label><input type="date" id="modal-user-birthdate" class="form-control" value="${data?.birthdate ?? ''}"></div>`;
      }
      
      modalFormFields.innerHTML = html;
      adminModal.style.display = 'flex';
  }

  // ============================================================
  // 7. معالجة النماذج (Form Handler with Error Fixes)
  // لمن: للنظام
  // لماذا: لتخزين البيانات بشكل صحيح وتجنب الانهيار
  // ============================================================

  async function handleAdminFormSubmit(e) {
      e.preventDefault();
      modalError.textContent = '';
      const type = modalDataType.value;
      const id = modalDocId.value;
      const order = document.getElementById('modal-order') ? Number(document.getElementById('modal-order').value) : 0;
      let data = {};
      let collectionName = '';

      try {
          if (type === 'map') {
              collectionName = 'maps';
              data = { name: document.getElementById('modal-map-name').value, link: document.getElementById('modal-map-link').value, order };
          } else if (type === 'maintenance') {
              collectionName = 'maintenanceNumbers';
              data = { area: document.getElementById('modal-maint-area').value, phone: document.getElementById('modal-maint-phone').value, order };
          } else if (type === 'material') {
              collectionName = 'materials';
              data = { 
                  name: document.getElementById('modal-mat-name').value, price: document.getElementById('modal-mat-price').value,
                  image: document.getElementById('modal-mat-image').value, category: document.getElementById('modal-mat-category').value,
                  specs: document.getElementById('modal-mat-specs').value.split('\n').filter(s=>s), order 
              };
          } else if (type === 'offer') {
              collectionName = 'offers';
              // ******************************************
              // إصلاح JSON: حماية التطبيق من الانهيار
              // ******************************************
              let jsonData;
              try {
                  jsonData = JSON.parse(document.getElementById('modal-offer-data').value);
              } catch (jsonErr) {
                  throw new Error("تنسيق JSON غير صحيح. تأكد من الأقواس والفواصل.");
              }
              data = { title: document.getElementById('modal-offer-title').value, note: document.getElementById('modal-offer-note').value, ...jsonData };
              if (!id) {
                   const newId = document.getElementById('modal-offer-id').value;
                   await setDoc(doc(db, "offers", newId), data);
                   adminModal.style.display = 'none'; showCustomAlert("تم الحفظ."); return;
              }
          } else if (type === 'vlan') {
              collectionName = 'vlans';
              data = { vlan: document.getElementById('modal-vlan-value').value, order };
              if (!id) {
                  const newId = document.getElementById('modal-vlan-id').value;
                  await setDoc(doc(db, "vlans", newId), data);
                  adminModal.style.display = 'none'; showCustomAlert("تم الحفظ."); return;
              }
          } else if (type === 'port') {
              collectionName = 'ports';
              data = { 
                  areaName: document.getElementById('modal-port-areaName').value, zone: document.getElementById('modal-port-zone').value,
                  portName: document.getElementById('modal-port-portName').value, landmark: document.getElementById('modal-post-landmark').value,
                  coordinates: document.getElementById('modal-port-coordinates').value, order 
              };
          } else if (type === 'sticker') {
              collectionName = 'stickers';
              data = { name: document.getElementById('modal-sticker-name').value, thumb: document.getElementById('modal-sticker-thumb').value, full: document.getElementById('modal-sticker-full').value, order };
          } else if (type === 'entertainmentApp') {
              collectionName = 'entertainmentApps';
              data = { name: document.getElementById('modal-app-name').value, image: document.getElementById('modal-app-image').value, description: document.getElementById('modal-app-desc').value, code: document.getElementById('modal-app-code').value, directUrl: document.getElementById('modal-app-direct').value, order };
          } else if (type === 'new-user') {
              // ******************************************
              // إصلاح إنشاء المستخدم: تحذير الأدمن واستخدام المعرف الصحيح
              // ******************************************
              const email = document.getElementById('modal-new-email').value; // استخدام ID الصحيح
              const pass = document.getElementById('modal-new-password').value;
              const role = document.getElementById('modal-new-role').value;
              const allSecs = ['maps', 'offers', 'vlans', 'materials', 'entertainment-apps', 'ports', 'maintenance'];
              const perms = (role === 'teamLeader') ? allSecs.filter(s => s !== 'offers') : allSecs;

              if(!confirm("تنبيه: سيقوم Firebase بتسجيل الدخول للمستخدم الجديد فور إنشائه، مما يعني تسجيل خروجك الحالي. هل تود المتابعة؟")) return;

              const cred = await createUserWithEmailAndPassword(auth, email, pass);
              await setDoc(doc(db, "users", cred.user.uid), {
                  uid: cred.user.uid, email, name: document.getElementById('modal-user-name').value,
                  phone: document.getElementById('modal-user-phone').value, birthdate: document.getElementById('modal-user-birthdate').value,
                  role, status: 'active', permissions: perms, createdAt: new Date()
              });
              adminModal.style.display = 'none'; 
              window.location.reload(); // إعادة تحميل الصفحة لأن المستخدم تغير
              return;
          } else if (type === 'user') {
              await updateDoc(doc(db, "users", id), {
                  name: document.getElementById('modal-user-name').value, phone: document.getElementById('modal-user-phone').value, birthdate: document.getElementById('modal-user-birthdate').value
              });
              adminModal.style.display = 'none'; loadAdminPanel(); return;
          }

          if (id) await updateDoc(doc(db, collectionName, id), data);
          else await addDoc(collection(db, collectionName), data);
          
          adminModal.style.display = 'none';
          showCustomAlert("تم الحفظ بنجاح.");
          
      } catch (err) {
          console.error(err);
          modalError.textContent = "خطأ: " + err.message;
      }
  }

});
