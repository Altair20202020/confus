// --- DATABASE DE USUÁRIOS E PERMISSÕES (Simulação LocalStorage) ---
const INITIAL_USERS = {
    "altair": { password: "123", displayName: "ALTAIR_ADMIN", isAdmin: true, permissions: { financas: true, almoxarifado: true, manutencao: true } },
    "meli": { password: "456", displayName: "MELI_USER", isAdmin: false, permissions: { financas: true, almoxarifado: false, manutencao: false } }
};

// Se não houver banco de usuários salvo, cria o padrão
if (!localStorage.getItem('sys_users_db')) {
    localStorage.setItem('sys_users_db', JSON.stringify(INITIAL_USERS));
}

let usersDB = JSON.parse(localStorage.getItem('sys_users_db'));
let currentUser = sessionStorage.getItem('logged_user') || null;
let currentActiveModule = null;
let transactions = [];

// Seleção de Telas Principais
const screenLogin = document.getElementById('login-screen');
const screenMenu = document.getElementById('menu-screen');
const screenFinancas = document.getElementById('system-dashboard');
const screenAdmin = document.getElementById('admin-panel');

// Elementos de Login
const usernameInput = document.getElementById('login-username');
const passwordInput = document.getElementById('login-password');
const btnLogin = document.getElementById('btn-login');
const loginError = document.getElementById('login-error');

// Elementos de Administração de Permissões
const searchUserInput = document.getElementById('admin-search-user');
const btnSearchUser = document.getElementById('btn-search-user');
const permissionsCard = document.getElementById('admin-user-permissions-card');
const editingUserTitle = document.getElementById('editing-user-title');
const chkFinancas = document.getElementById('perm-financas');
const chkAlmoxarifado = document.getElementById('perm-almoxarifado');
const chkManutencao = document.getElementById('perm-manutencao');
const btnSavePermissions = document.getElementById('btn-save-permissions');
let userBeingEdited = null;

// Elementos do Módulo Finanças
const totalBalance = document.getElementById('total-balance');
const totalEntries = document.getElementById('total-entries');
const totalExpenses = document.getElementById('total-expenses');
const transTitleInput = document.getElementById('trans-title');
const transValueInput = document.getElementById('trans-value');
const transTypeSelect = document.getElementById('trans-type');
const btnSaveTransaction = document.getElementById('btn-save');
const btnClearTransactions = document.getElementById('btn-clear');
const listContainer = document.getElementById('list-container');


// ================= CORE DE SESSÃO E LOGIN =================
function handleLogin() {
    const username = usernameInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    if (usersDB[username] && usersDB[username].password === password) {
        currentUser = username;
        sessionStorage.setItem('logged_user', username);
        loginError.innerText = "";
        usernameInput.value = "";
        passwordInput.value = "";
        showScreen(screenMenu);
        renderMenu();
    } else {
        loginError.innerText = "ACESSO NEGADO: CREDENCIAIS INVÁLIDAS";
    }
}

function handleLogout() {
    currentUser = null;
    sessionStorage.removeItem('logged_user');
    currentActiveModule = null;
    showScreen(screenLogin);
}

// Alternador de Telas Universal
function showScreen(screenTarget) {
    [screenLogin, screenMenu, screenFinancas, screenAdmin].forEach(s => s.classList.add('hidden'));
    screenTarget.classList.remove('hidden');
}

// Configurar elementos de texto comuns de usuário logado nas headers
function updateHeaderUsernames() {
    if (!currentUser) return;
    document.querySelectorAll('.user-placeholder-name').forEach(el => {
        el.innerText = usersDB[currentUser].displayName;
    });
}

// Renderiza o menu aplicando as travas de permissão
function renderMenu() {
    updateHeaderUsernames();
    const userObj = usersDB[currentUser];

    // Card do Administrador
    const cardAdmin = document.getElementById('mod-admin');
    if (userObj.isAdmin) {
        cardAdmin.classList.remove('hidden');
    } else {
        cardAdmin.classList.add('hidden');
    }

    // Gerenciar avisos visuais de travas
    document.querySelectorAll('.module-card:not(.disabled):not(.admin-only)').forEach(card => {
        const moduleName = card.getAttribute('data-module');
        const hasAccess = userObj.permissions[moduleName];
        const badge = card.querySelector('.badge-permission');

        if (hasAccess) {
            card.style.opacity = "1";
            badge.innerText = "ACESSO_LIBERADO";
            badge.style.color = "var(--color-success)";
            badge.style.borderColor = "var(--color-success)";
        } else {
            card.style.opacity = "0.6";
            badge.innerText = "BLOQUEADO_PELO_ADMIN";
            badge.style.color = "var(--color-danger)";
            badge.style.borderColor = "var(--color-danger)";
        }
    });
}

// Clique nos Módulos
document.querySelectorAll('.module-card').forEach(card => {
    card.addEventListener('click', () => {
        if (card.classList.contains('disabled')) return;
        
        const moduleName = card.getAttribute('data-module');
        const userObj = usersDB[currentUser];

        if (moduleName === 'admin' && userObj.isAdmin) {
            showScreen(screenAdmin);
            return;
        }

        // Verifica permissão comum
        if (userObj.permissions[moduleName]) {
            if (moduleName === 'financas') {
                currentActiveModule = 'financas';
                showScreen(screenFinancas);
                loadFinancasData();
            }
        } else {
            alert("ERRO_DE_SEGURANÇA: Você não possui diretivas de acesso a este módulo. Contate o Administrador.");
        }
    });
});

// Botões de Voltar para o Menu Principal
document.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', () => {
        currentActiveModule = null;
        showScreen(screenMenu);
        renderMenu();
    });
});

// Registrar botões de Logoff globais
document.querySelectorAll('.btn-trigger-logout').forEach(btn => {
    btn.addEventListener('click', handleLogout);
});


// ================= SEÇÃO ADMINISTRATIVA (PERMISSÕES) =================
btnSearchUser.addEventListener('click', () => {
    const query = searchUserInput.value.trim().toLowerCase();
    
    if (usersDB[query]) {
        userBeingEdited = query;
        editingUserTitle.innerText = `EDITANDO_DIRETIVAS: ${query.toUpperCase()}`;
        
        // Seta os checkboxes conforme o banco
        chkFinancas.checked = usersDB[query].permissions.financas;
        chkAlmoxarifado.checked = usersDB[query].permissions.almoxarifado;
        chkManutencao.checked = usersDB[query].permissions.manutencao;
        
        permissionsCard.classList.remove('hidden');
    } else {
        alert("SISTEMA: Usuário não localizado na árvore de diretórios.");
        permissionsCard.classList.add('hidden');
        userBeingEdited = null;
    }
});

btnSavePermissions.addEventListener('click', () => {
    if (!userBeingEdited) return;

    // Salva as permissões da tela no objeto
    usersDB[userBeingEdited].permissions.financas = chkFinancas.checked;
    usersDB[userBeingEdited].permissions.almoxarifado = chkAlmoxarifado.checked;
    usersDB[userBeingEdited].permissions.manutencao = chkManutencao.checked;

    // Persiste no LocalStorage
    localStorage.setItem('sys_users_db', JSON.stringify(usersDB));
    alert(`DIRETIVAS ATUALIZADAS: Permissões de ${userBeingEdited.toUpperCase()} aplicadas com sucesso.`);
    
    permissionsCard.classList.add('hidden');
    searchUserInput.value = "";
});


// ================= MÓDULO: FINANÇAS (ENGINE) =================
function loadFinancasData() {
    const storageKey = `my_finances_data_${currentUser}`;
    transactions = JSON.parse(localStorage.getItem(storageKey)) || [];
    updateBalances();
    renderList();
}

function formatCurrency(value) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function updateBalances() {
    let entries = 0, expenses = 0;
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
        listContainer.innerHTML = '<p style="text-align:center; color:#94a3b8; font-size:12px; padding:20px;">[SISTEMA_VAZIO]: SEM LANÇAMENTOS</p>';
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
    saveFinancasData();
    updateBalances();
    renderList();
}

function addTransaction() {
    const title = transTitleInput.value.trim();
    const value = parseFloat(transValueInput.value);
    const type = transTypeSelect.value;

    if (!title || isNaN(value) || value <= 0) {
        alert('OPERAÇÃO RECUSADA: DADOS INCORRETOS.');
        return;
    }
    transactions.push({ title, value, type, completed: false });
    transTitleInput.value = ''; transValueInput.value = '';
    saveFinancasData(); updateBalances(); renderList();
}

function saveFinancasData() {
    const storageKey = `my_finances_data_${currentUser}`;
    localStorage.setItem(storageKey, JSON.stringify(transactions));
}

// Eventos internos de Finanças
btnSaveTransaction.addEventListener('click', addTransaction);
btnClearTransactions.addEventListener('click', () => {
    if (confirm('Deseja deletar permanentemente a tabela deste usuário?')) {
        transactions = []; saveFinancasData(); updateBalances(); renderList();
    }
});

// Eventos de teclas auxiliares
passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });
btnLogin.addEventListener('click', handleLogin);

// Inicialização do Sistema do Gate de segurança
if (currentUser) {
    showScreen(screenMenu);
    renderMenu();
} else {
    showScreen(screenLogin);
}