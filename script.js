// --- CONFIGURAÇÃO DE USUÁRIOS DO SISTEMA ---
const VALID_USERS = {
    "altair": { password: "123", displayName: "ALTAIR_ADMIN" },
    "meli": { password: "456", displayName: "MELI_USER" }
};

let currentUser = sessionStorage.getItem('logged_user') || null;
let transactions = [];

// Elementos de Login
const loginScreen = document.getElementById('login-screen');
const systemDashboard = document.getElementById('system-dashboard');
const usernameInput = document.getElementById('login-username');
const passwordInput = document.getElementById('login-password');
const btnLogin = document.getElementById('btn-login');
const loginError = document.getElementById('login-error');
const currentUserName = document.getElementById('current-user-name');
const btnLogout = document.getElementById('btn-logout');

// Elementos do Painel Financeiro
const totalBalance = document.getElementById('total-balance');
const totalEntries = document.getElementById('total-entries');
const totalExpenses = document.getElementById('total-expenses');
const transTitleInput = document.getElementById('trans-title');
const transValueInput = document.getElementById('trans-value');
const transTypeSelect = document.getElementById('trans-type');
const btnSave = document.getElementById('btn-save');
const btnClear = document.getElementById('btn-clear');
const listContainer = document.getElementById('list-container');

// --- SISTEMA DE LOGIN ---
function handleLogin() {
    const username = usernameInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    if (VALID_USERS[username] && VALID_USERS[username].password === password) {
        currentUser = username;
        sessionStorage.setItem('logged_user', username);
        loginError.innerText = "";
        usernameInput.value = "";
        passwordInput.value = "";
        initSystem();
    } else {
        loginError.innerText = "ERRO: USUÁRIO OU SENHA INCORRETOS";
    }
}

function handleLogout() {
    currentUser = null;
    sessionStorage.removeItem('logged_user');
    checkAuth();
}

function checkAuth() {
    if (currentUser) {
        loginScreen.classList.add('hidden');
        systemDashboard.classList.remove('hidden');
        currentUserName.innerText = VALID_USERS[currentUser].displayName;
        loadUserData();
    } else {
        loginScreen.classList.remove('hidden');
        systemDashboard.classList.add('hidden');
    }
}

// --- SISTEMA FINANCEIRO SEPARADO POR USUÁRIO ---
function loadUserData() {
    // Chave dinâmica baseada no usuário logado: ex: my_finances_data_altair
    const storageKey = `my_finances_data_${currentUser}`;
    transactions = JSON.parse(localStorage.getItem(storageKey)) || [];
    updateBalances();
    renderList();
}

function formatCurrency(value) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function updateBalances() {
    let entries = 0;
    let expenses = 0;

    transactions.forEach(item => {
        if (!item.completed) {
            if (item.type === 'entrada') entries += item.value;
            else expenses += item.value;
        }
    });

    totalBalance.innerText = formatCurrency(entries - expenses);
    totalEntries.innerText = formatCurrency(entries);
    totalExpenses.innerText = formatCurrency(expenses);
}

function renderList() {
    listContainer.innerHTML = '';

    if (transactions.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; color:#94a3b8; font-size:12px; padding:20px;">[SISTEMA_VAZIO]: NENHUM REGISTRO LOCALIZADO</p>';
        return;
    }

    transactions.forEach((item, index) => {
        const div = document.createElement('div');
        div.classList.add('transaction-item', `item-${item.type}`);
        if (item.completed) div.classList.add('completed');

        div.addEventListener('click', () => toggleComplete(index));

        div.innerHTML = `
            <div class="item-left">
                <div class="check-box">${item.completed ? '✓' : ''}</div>
                <span class="item-info">${item.title}</span>
            </div>
            <span class="item-value">${item.type === 'entrada' ? '+' : '-'} ${formatCurrency(item.value)}</span>
        `;
        listContainer.appendChild(div);
    });
}

function toggleComplete(index) {
    transactions[index].completed = !transactions[index].completed;
    saveData();
    updateBalances();
    renderList();
}

function addTransaction() {
    const title = transTitleInput.value.trim();
    const value = parseFloat(transValueInput.value);
    const type = transTypeSelect.value;

    if (!title || isNaN(value) || value <= 0) {
        alert('EXECUÇÃO ABORTADA: PREENCHA OS CAMPOS CORRETAMENTE.');
        return;
    }

    transactions.push({ title, value, type, completed: false });
    transTitleInput.value = '';
    transValueInput.value = '';

    saveData();
    updateBalances();
    renderList();
}

function saveData() {
    const storageKey = `my_finances_data_${currentUser}`;
    localStorage.setItem(storageKey, JSON.stringify(transactions));
}

// --- EVENTOS E INICIALIZAÇÃO ---
btnLogin.addEventListener('click', handleLogin);
btnLogout.addEventListener('click', handleLogout);
btnSave.addEventListener('click', addTransaction);

btnClear.addEventListener('click', () => {
    if (confirm('ALERTA: DESEJA EXCLUIR DEFINITIVAMENTE OS DADOS DESTE USUÁRIO?')) {
        transactions = [];
        saveData();
        updateBalances();
        renderList();
    }
});

// Detectar a tecla "Enter" no formulário de login
passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
});

function initSystem() {
    checkAuth();
}

// Iniciar o fluxo principal
initSystem();