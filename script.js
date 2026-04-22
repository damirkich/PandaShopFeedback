// ==================== SUPABASE SETUP ====================
const SUPABASE_URL = window.ENV?.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Missing Supabase environment variables.");
}

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== PUBLIC FORM SUBMISSION ====================
async function submitFeedback(event) {
    event.preventDefault();
    
    // Get form values
    const fullName = document.getElementById("full_name")?.value || "";
    const overallImpression = document.getElementById("overall_impression")?.value;
    const wantedProducts = document.getElementById("wanted_products")?.value || "";
    const formMessage = document.getElementById("formMessage");
    
    // Validate required fields
    if (!overallImpression) {
        if (formMessage) {
            formMessage.textContent = "❌ Будь ласка, заповніть поле 'Загальне враження'.";
            formMessage.style.color = "red";
        } else {
            alert("Будь ласка, заповніть поле 'Загальне враження'.");
        }
        return;
    }
    
    // Show loading state
    const submitBtn = document.querySelector("#feedbackForm button[type='submit']");
    if (!submitBtn) return;
    
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "⏳ Надсилання...";
    submitBtn.disabled = true;
    
    if (formMessage) {
        formMessage.textContent = "⏳ Надсилання вашого відгуку...";
        formMessage.style.color = "blue";
    }
    
    // Insert into Supabase
    const { data, error } = await supabaseClient
        .from("panda_shop_feedback")
        .insert([
            {
                full_name: fullName,
                overall_impression: overallImpression,
                wanted_products: wantedProducts,
                created_at: new Date().toISOString()
            }
        ]);
    
    // Reset button state
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
    
    if (error) {
        console.error("Supabase insert error:", error);
        if (formMessage) {
            formMessage.textContent = "❌ Помилка при надсиланні. Спробуйте ще раз.";
            formMessage.style.color = "red";
        } else {
            alert("❌ Помилка при надсиланні. Спробуйте ще раз.");
        }
        return;
    }
    
    // Success!
    if (formMessage) {
        formMessage.textContent = "✅ Дякуємо за ваш відгук!";
        formMessage.style.color = "green";
    } else {
        alert("✅ Дякуємо за ваш відгук!");
    }
    
    event.target.reset();
}

// ==================== ADMIN PANEL FUNCTIONS ====================
async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
        const isEmployee = await checkIfEmployee(session.user.email);
        if (isEmployee) {
            showAdminPanel();
            loadFeedback();
        } else {
            showLoginForm("Доступ тільки для працівників Panda Shop.");
        }
    } else {
        showLoginForm();
    }
}

async function login() {
    const email = document.getElementById("adminEmail")?.value.trim();
    const password = document.getElementById("adminPassword")?.value.trim();
    const loginError = document.getElementById("loginError");
    
    if (!email || !password) {
        if (loginError) loginError.textContent = "Введіть email та пароль.";
        return;
    }
    
    if (loginError) loginError.textContent = "⏳ Вхід...";
    
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });
    
    if (error) {
        console.error("Login error:", error);
        if (loginError) loginError.textContent = "Невірний email або пароль.";
        return;
    }
    
    const isEmployee = await checkIfEmployee(email);
    
    if (!isEmployee) {
        await supabaseClient.auth.signOut();
        if (loginError) loginError.textContent = "Доступ тільки для працівників Panda Shop.";
        return;
    }
    
    showAdminPanel();
    loadFeedback();
}

async function checkIfEmployee(email) {
    const { data, error } = await supabaseClient
        .from("panda_shop_employees")
        .select("email")
        .eq("email", email)
        .single();
    
    if (error && error.code !== "PGRST116") {
        console.error("Employee check error:", error);
    }
    
    return !!data;
}

async function logout() {
    await supabaseClient.auth.signOut();
    showLoginForm();
}

function showLoginForm(errorMessage = "") {
    const loginForm = document.getElementById("loginForm");
    const adminPanel = document.getElementById("adminPanel");
    
    if (loginForm) loginForm.style.display = "flex";
    if (adminPanel) adminPanel.style.display = "none";
    
    const loginError = document.getElementById("loginError");
    if (loginError && errorMessage) {
        loginError.textContent = errorMessage;
    } else if (loginError) {
        loginError.textContent = "";
    }
}

function showAdminPanel() {
    const loginForm = document.getElementById("loginForm");
    const adminPanel = document.getElementById("adminPanel");
    
    if (loginForm) loginForm.style.display = "none";
    if (adminPanel) adminPanel.style.display = "block";
}

async function deleteFeedback(id) {
    if (!confirm("Ви впевнені, що хочете видалити цей відгук?")) {
        return;
    }
    
    const { error } = await supabaseClient
        .from("panda_shop_feedback")
        .delete()
        .eq("id", id);
    
    if (error) {
        console.error("Supabase delete error:", error);
        alert("Не вдалося видалити відгук. Спробуйте ще раз.");
        return;
    }
    
    loadFeedback();
}

async function loadFeedback() {
    const feedbackList = document.getElementById("feedbackList");
    if (!feedbackList) return;
    
    feedbackList.innerHTML = '<div class="loading">⏳ Завантаження відгуків...</div>';
    
    const { data, error } = await supabaseClient
        .from("panda_shop_feedback")
        .select("*")
        .order("created_at", { ascending: false });
    
    if (error) {
        console.error("Supabase fetch error:", error);
        feedbackList.innerHTML = "<p style='color: red;'>❌ Помилка завантаження відгуків.</p>";
        return;
    }
    
    if (!data || data.length === 0) {
        feedbackList.innerHTML = "<p style='text-align: center; color: #888;'>📭 Поки що немає відгуків.</p>";
        return;
    }
    
    feedbackList.innerHTML = data.map((item) => {
        return `
            <div class="feedback-card">
                <button class="delete-btn" onclick="deleteFeedback('${item.id}')">🗑️ Видалити</button>
                <p><strong>👤 Ім'я та прізвище:</strong> ${item.full_name ? escapeHtml(item.full_name) : "Надіслано анонімно"}</p>
                <p><strong>⭐ Загальне враження:</strong> ${escapeHtml(item.overall_impression)}</p>
                <p><strong>🎁 Бажані продукти:</strong> ${escapeHtml(item.wanted_products)}</p>
                <p class="date-text"><strong>📅 Коли було надіслано:</strong> ${new Date(item.created_at).toLocaleString('uk-UA')}</p>
            </div>
        `;
    }).join("");
}

function escapeHtml(value) {
    if (!value) return '';
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==================== INITIALIZATION ====================
document.addEventListener("DOMContentLoaded", function() {
    // Check if we're on the public form page (index.html)
    const feedbackForm = document.getElementById("feedbackForm");
    if (feedbackForm) {
        feedbackForm.addEventListener("submit", submitFeedback);
    }
    
    // Check if we're on the admin page (admin.html)
    const loginForm = document.getElementById("loginForm");
    const adminPanel = document.getElementById("adminPanel");
    if (loginForm || adminPanel) {
        checkAuth();
    }
});