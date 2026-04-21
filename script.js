        const SUPABASE_URL = window.ENV?.SUPABASE_URL;
        const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY;

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            console.error("Missing Supabase environment variables.");
        }

        const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // Перевіряємо, чи користувач вже авторизований
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

        // Функція входу
        async function login() {
            const email = document.getElementById("adminEmail").value.trim();
            const password = document.getElementById("adminPassword").value.trim();
            const loginError = document.getElementById("loginError");
            
            if (!email || !password) {
                loginError.textContent = "Введіть email та пароль.";
                return;
            }
            
            loginError.textContent = "⏳ Вхід...";
            
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (error) {
                console.error("Login error:", error);
                loginError.textContent = "Невірний email або пароль.";
                return;
            }
            
            const isEmployee = await checkIfEmployee(email);
            
            if (!isEmployee) {
                await supabaseClient.auth.signOut();
                loginError.textContent = "Доступ тільки для працівників Panda Shop.";
                return;
            }
            
            showAdminPanel();
            loadFeedback();
        }

        // Перевірка, чи email є в списку працівників
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

        // Функція виходу
        async function logout() {
            await supabaseClient.auth.signOut();
            showLoginForm();
        }

        // Показати форму входу
        function showLoginForm(errorMessage = "") {
            document.getElementById("loginForm").style.display = "flex";
            document.getElementById("adminPanel").style.display = "none";
            if (errorMessage) {
                document.getElementById("loginError").textContent = errorMessage;
            } else {
                document.getElementById("loginError").textContent = "";
            }
        }

        // Показати адмін панель
        function showAdminPanel() {
            document.getElementById("loginForm").style.display = "none";
            document.getElementById("adminPanel").style.display = "block";
        }

        // Функція видалення сабміту
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

        // Завантаження відгуків
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

        // Запускаємо перевірку авторизації при завантаженні
        checkAuth();