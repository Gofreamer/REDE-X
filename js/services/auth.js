/* Rede X — Auth */

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('btn-login');
  errorEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Entrando…';
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    errorEl.textContent = translateAuthError(err.code);
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('register-name').value.trim();
  const handleRaw = document.getElementById('register-handle').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const errorEl = document.getElementById('register-error');
  const btn = document.getElementById('btn-register');

  const handle = normalizeHandle(handleRaw);
  errorEl.textContent = '';

  if (!handle || handle.length < 2) {
    errorEl.textContent = 'Handle inválido (mín. 2 caracteres, a-z 0-9 _).';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Criando…';

  try {
    // checa handle (rules de handles permitem leitura pública)
    const taken = await db.ref('handles/' + handle).once('value');
    if (taken.exists()) {
      errorEl.textContent = 'Esse @ já está em uso.';
      btn.disabled = false;
      btn.textContent = 'Criar conta';
      return;
    }

    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;
    const profile = {
      name: name || handle,
      handle,
      email,
      bio: '',
      avatar: '',
      isAdmin: false,
      createdAt: Date.now()
    };
    await db.ref('users/' + uid).set(profile);
    await db.ref('handles/' + handle).set({ uid, name: profile.name });
  } catch (err) {
    console.error('register', err);
    // se Auth criou user mas DB falhou, ainda mostra erro útil
    const code = err.code || '';
    const msg = translateAuthError(code);
    errorEl.textContent = msg === 'Erro ao autenticar.'
      ? (err.message || code || 'Erro ao criar conta. Confira Auth + Rules.')
      : msg;
    btn.disabled = false;
    btn.textContent = 'Criar conta';
  }
}

async function handleLogout() {
  await auth.signOut();
}

function translateAuthError(code) {
  const map = {
    'auth/user-not-found': 'Conta não encontrada.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/email-already-in-use': 'E-mail já em uso.',
    'auth/weak-password': 'Senha: mínimo 6 caracteres.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde.',
    'auth/operation-not-allowed': 'E-mail/senha desativado no Firebase Auth.',
    'auth/network-request-failed': 'Falha de rede. Tente de novo.',
    'PERMISSION_DENIED': 'Rules do Database bloquearam a escrita. Publique rules atualizadas.'
  };
  return map[code] || 'Erro ao autenticar.';
}

function switchAuthTab(tab) {
  const login = document.getElementById('login-form');
  const reg = document.getElementById('register-form');
  const tLogin = document.getElementById('tab-login');
  const tReg = document.getElementById('tab-register');
  if (tab === 'login') {
    login.classList.remove('hidden');
    reg.classList.add('hidden');
    tLogin.classList.add('active');
    tReg.classList.remove('active');
  } else {
    login.classList.add('hidden');
    reg.classList.remove('hidden');
    tLogin.classList.remove('active');
    tReg.classList.add('active');
  }
}

function showAuthScreen() {
  document.getElementById('auth-screen')?.classList.remove('hidden');
  document.getElementById('app')?.classList.add('hidden');
}

function showApp() {
  document.getElementById('auth-screen')?.classList.add('hidden');
  document.getElementById('app')?.classList.remove('hidden');
}
