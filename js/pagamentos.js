// js/pagamentos.js

import { firestore } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { updateCartBadge } from './main.js';

// URL do seu servidor backend que se comunica com o Asaas
// Alterado para um caminho relativo para funcionar em qualquer ambiente (local ou nuvem).
const BACKEND_URL = '';

document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores do DOM ---
    const totalValueDisplay = document.getElementById('total-value-display');
    const paymentMethodRadios = document.querySelectorAll('input[name="payment-method"]');
    const cardFormContainer = document.getElementById('card-payment-form-container');
    const cardForm = document.getElementById('card-payment-form');
    const cardFormTitle = document.getElementById('card-form-title');
    const mainConfirmBtnContainer = document.getElementById('main-confirm-button-container');
    const mainConfirmBtn = document.getElementById('main-confirm-btn');
    const confirmCardPaymentBtn = document.getElementById('confirm-card-payment-btn');

    // --- Seletores dos Modais ---
    const pixModalOverlay = document.getElementById('pix-modal-overlay');
    const pixTotalValue = document.getElementById('pix-modal-total-value');
    const pixQrContainer = document.getElementById('pix-qr-code-container');
    const pixCopyPasteInput = document.getElementById('pix-copy-paste-code');
    const copyPixBtn = document.getElementById('copy-pix-code-btn');
    const paymentMadeBtn = document.getElementById('payment-made-btn');
    const closePixModalBtn = document.getElementById('close-pix-modal-btn');
    const moneyModalOverlay = document.getElementById('money-modal-overlay');
    const moneyAmountInput = document.getElementById('money-amount');
    const confirmMoneyBtn = document.getElementById('confirm-money-payment-btn');
    const closeMoneyModalBtn = document.getElementById('close-money-modal-btn');
    const confirmationOverlay = document.getElementById('confirmation-overlay');
    const closeConfirmationBtn = document.getElementById('close-confirmation-btn');
    
    // --- Variáveis de Estado ---
    let orderTotal = 0;
    let orderAddress = {};
    let loggedInUser = {};
    let currentAsaasPayment = null;

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    function init() {
        const rawLoggedInUser = sessionStorage.getItem('loggedInUser');
        const rawOrderTotal = sessionStorage.getItem('pizzariaOrderTotal');
        const rawOrderAddress = sessionStorage.getItem('pizzariaOrderAddress');

        if (!rawLoggedInUser || !rawOrderTotal || !rawOrderAddress) {
            alert("Sessão inválida. Por favor, refaça o pedido a partir do carrinho.");
            window.location.href = 'carrinho.html';
            return;
        }

        loggedInUser = JSON.parse(rawLoggedInUser);
        orderTotal = parseFloat(rawOrderTotal);
        orderAddress = JSON.parse(rawOrderAddress);

        if (!loggedInUser.cpf || loggedInUser.cpf.replace(/\D/g, '').length !== 11) {
            alert("Seu CPF não está preenchido ou é inválido. Por favor, atualize seu perfil antes de continuar.");
            window.location.href = 'perfil.html';
            return;
        }

        totalValueDisplay.textContent = formatCurrency(orderTotal);
        setupEventListeners();
    }

    function setupEventListeners() {
        paymentMethodRadios.forEach(radio => radio.addEventListener('change', handlePaymentSelection));
        mainConfirmBtn.addEventListener('click', handleMainConfirm);
        
        cardForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const selectedMethodRadio = document.querySelector('input[name="payment-method"]:checked');
            handleCardPayment(selectedMethodRadio.value.toUpperCase());
        });

        closePixModalBtn.addEventListener('click', () => pixModalOverlay.classList.remove('visible'));
        paymentMadeBtn.addEventListener('click', () => finalizeOrder('PIX'));
        copyPixBtn.addEventListener('click', copyPixCode);

        closeMoneyModalBtn.addEventListener('click', () => moneyModalOverlay.classList.remove('visible'));
        moneyAmountInput.addEventListener('input', calculateChange);
        confirmMoneyBtn.addEventListener('click', () => {
             const troco = parseFloat(moneyAmountInput.value) - orderTotal;
             finalizeOrder('Dinheiro', { troco: formatCurrency(troco), valorPago: formatCurrency(moneyAmountInput.value) });
        });

        closeConfirmationBtn.addEventListener('click', () => window.location.href = 'perfil.html');
    }

    function handlePaymentSelection(event) {
        const selectedValue = event.target.value;
        const isCard = selectedValue === 'credit_card' || selectedValue === 'debit_card';
        
        cardFormContainer.style.display = isCard ? 'block' : 'none';
        mainConfirmBtnContainer.style.display = !isCard ? 'block' : 'none';

        if (isCard) {
            cardFormTitle.textContent = selectedValue === 'credit_card' ? 'Pagamento com Cartão de Crédito' : 'Pagamento com Cartão de Débito';
        }
    }

    async function handleMainConfirm() {
        const selectedMethodRadio = document.querySelector('input[name="payment-method"]:checked');
        if (!selectedMethodRadio) {
            alert("Selecione uma forma de pagamento.");
            return;
        }
        const method = selectedMethodRadio.value.toUpperCase();
        
        mainConfirmBtn.disabled = true;
        mainConfirmBtn.textContent = 'Processando...';

        if (method === 'PIX') {
            await createAsaasPayment('PIX');
        } else if (method === 'MONEY') {
            showMoneyModal(); 
        }

        mainConfirmBtn.disabled = false;
        mainConfirmBtn.textContent = 'Confirmar Pedido';
    }

    async function handleCardPayment(asaasMethod) {
        confirmCardPaymentBtn.disabled = true;
        confirmCardPaymentBtn.textContent = 'Processando...';

        const cardNumber = document.getElementById('card-number').value;
        const cardName = document.getElementById('card-name').value;
        const cardExpiry = document.getElementById('card-expiry').value;
        const cardCvv = document.getElementById('card-cvv').value;

        if (!cardNumber || !cardName || !cardExpiry || !cardCvv) {
            alert("Preencha todos os dados do cartão.");
            confirmCardPaymentBtn.disabled = false;
            confirmCardPaymentBtn.textContent = 'Pagar com Cartão';
            return;
        }
        
        const [expiryMonth, expiryYearSuffix] = cardExpiry.split('/').map(s => s.trim());
        if (!expiryMonth || !expiryYearSuffix || expiryYearSuffix.length !== 2) {
             alert("Formato de validade inválido. Use MM/AA.");
             confirmCardPaymentBtn.disabled = false;
             confirmCardPaymentBtn.textContent = 'Pagar com Cartão';
             return;
        }
        const expiryYear = `20${expiryYearSuffix}`;

        const cardData = { number: cardNumber, name: cardName, expiryMonth, expiryYear, cvv: cardCvv };
        
        await createAsaasPayment(asaasMethod, cardData);

        confirmCardPaymentBtn.disabled = false;
        confirmCardPaymentBtn.textContent = 'Pagar com Cartão';
    }

    async function createAsaasPayment(method, cardData = null) {
        const payload = {
            userData: loggedInUser,
            addressData: orderAddress,
            total: orderTotal,
            paymentMethod: method,
            cardData: cardData
        };
    
        try {
            // A chamada agora usa um caminho relativo
            const response = await fetch(`/api/create-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
    
            if (!response.ok) {
                console.error('Erro retornado pelo backend:', data);
                const errorMsg = data.details && data.details[0] ? data.details[0].description : data.error;
                alert(`Erro ao processar pagamento: ${errorMsg}`);
                return;
            }
    
            currentAsaasPayment = data;
    
            if (method === 'PIX') {
                if (data && data.pixQrCode && data.pixQrCode.encodedImage) {
                    pixTotalValue.textContent = formatCurrency(data.value);
                    pixQrContainer.innerHTML = `<img src="data:image/png;base64,${data.pixQrCode.encodedImage}" alt="QR Code PIX">`;
                    pixCopyPasteInput.value = data.pixQrCode.payload;
                    pixModalOverlay.classList.add('visible');
                } else {
                    console.error("A resposta da API para o PIX não continha os dados do QR Code. Resposta recebida:", data);
                    alert("Ocorreu um erro inesperado ao gerar o QR Code do PIX.");
                }
            } else if (method === 'CREDIT_CARD' || method === 'DEBIT_CARD') {
                if (data.status === 'CONFIRMED' || data.status === 'RECEIVED') {
                    alert('Pagamento com cartão aprovado!');
                    finalizeOrder('Cartão de Crédito');
                } else {
                    alert(`O pagamento está sendo processado. Status: ${data.status}`);
                    finalizeOrder('Cartão (Pendente)');
                }
            }
        } catch (error) {
            console.error("Erro de comunicação com o servidor:", error);
            alert("Não foi possível conectar ao servidor de pagamentos.");
        }
    }
    
    function copyPixCode() {
        navigator.clipboard.writeText(pixCopyPasteInput.value).then(() => {
            copyPixBtn.innerHTML = '<i class="material-icons">check</i>';
            setTimeout(() => { copyPixBtn.innerHTML = '<i class="material-icons">content_copy</i>'; }, 2000);
        });
    }

    function showMoneyModal() {
        const moneyTotalValue = document.getElementById('money-modal-total-value');
        const changeDisplayBox = document.getElementById('change-display');
        moneyTotalValue.textContent = formatCurrency(orderTotal);
        moneyAmountInput.value = '';
        changeDisplayBox.style.display = 'none';
        confirmMoneyBtn.disabled = true;
        moneyModalOverlay.classList.add('visible');
    }

    function calculateChange() {
        const changeDisplayBox = document.getElementById('change-display');
        const changeValueEl = document.getElementById('change-value');
        const amountPaid = parseFloat(moneyAmountInput.value) || 0;
        if (amountPaid >= orderTotal) {
            const change = amountPaid - orderTotal;
            changeValueEl.textContent = formatCurrency(change);
            changeDisplayBox.style.display = 'flex';
            confirmMoneyBtn.disabled = false;
        } else {
            changeDisplayBox.style.display = 'none';
            confirmMoneyBtn.disabled = true;
        }
    }

    async function finalizeOrder(paymentMethod, details = {}) {
        const activeModal = document.querySelector('.payment-modal-overlay.visible');
        try {
            const cart = JSON.parse(localStorage.getItem('pizzariaCart')) || {};
            const newOrder = {
                userId: loggedInUser.id,
                // =========================================================================
                //  CORREÇÃO APLICADA AQUI: Adicionando o telefone ao objeto do cliente
                // =========================================================================
                cliente: { 
                    nome: loggedInUser.nome, 
                    email: loggedInUser.email, 
                    cpf: loggedInUser.cpf,
                    telefone: loggedInUser.telefone // <-- LINHA ADICIONADA
                },
                // =========================================================================
                itens: cart,
                total: orderTotal,
                endereco: orderAddress,
                formaPagamento: paymentMethod,
                status: (paymentMethod === 'PIX' || paymentMethod === 'Dinheiro') ? 'Em preparo' : 'Pagamento Pendente',
                data: serverTimestamp(),
                asaasPaymentId: currentAsaasPayment ? currentAsaasPayment.id : null,
                ...details
            };
            await addDoc(collection(firestore, 'pedidos'), newOrder);
            localStorage.removeItem('pizzariaCart');
            sessionStorage.removeItem('pizzariaOrderTotal');
            sessionStorage.removeItem('pizzariaOrderAddress');
            updateCartBadge();
            if (activeModal) activeModal.classList.remove('visible');
            confirmationOverlay.classList.add('visible');
        } catch (error) {
            console.error("Erro ao finalizar o pedido:", error);
            alert("Não foi possível registrar o pedido. Tente novamente.");
        }
    }

    init();
});