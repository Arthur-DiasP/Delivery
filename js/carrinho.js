// js/carrinho.js

import { updateCartBadge } from './main.js';
import { firestore } from './firebase-config.js';
import { doc, getDoc, updateDoc, deleteField, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    // --- SELETORES DO DOM ---
    const cartItemsContainer = document.getElementById('cart-items');
    const subtotalEl = document.getElementById('subtotal');
    const deliveryFeeEl = document.getElementById('delivery-fee');
    const grandTotalEl = document.getElementById('grand-total');
    const checkoutButton = document.getElementById('checkout-button');
    const cepInput = document.getElementById('cep-input');
    const ruaInput = document.getElementById('rua-input');
    const numeroInput = document.getElementById('numero-input');
    const bairroInput = document.getElementById('bairro-input');
    const complementoInput = document.getElementById('complemento-input');
    const saveAddressCheckbox = document.getElementById('save-address-checkbox');
    
    // Seletores para a funcionalidade de cupom promocional
    const couponInput = document.getElementById('coupon-code-input');
    const applyCouponBtn = document.getElementById('apply-coupon-btn');
    const couponFeedbackEl = document.getElementById('coupon-feedback');
    const appliedCouponRow = document.getElementById('applied-coupon-row');
    const couponCodeDisplay = document.getElementById('coupon-code-display');
    const discountAmountEl = document.getElementById('discount-amount');
    const removeCouponBtn = document.getElementById('remove-coupon-btn');

    // --- FUNÇÕES AUXILIARES ---
    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    const validateCheckoutButton = () => {
        const cart = JSON.parse(localStorage.getItem('pizzariaCart')) || {};
        const cartHasItems = Object.keys(cart).length > 0;
        const addressIsFilled = 
            cepInput.value.length === 9 &&
            ruaInput.value.trim() !== '' &&
            bairroInput.value.trim() !== '' &&
            numeroInput.value.trim() !== '';

        checkoutButton.disabled = !(cartHasItems && addressIsFilled);
        checkoutButton.title = checkoutButton.disabled 
            ? "Adicione itens e preencha o endereço para continuar."
            : "Prosseguir para o pagamento";
    };
    
    const fetchAddressFromCep = async (cep) => {
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();
            if (data.erro) {
                alert('CEP não encontrado.');
                ruaInput.value = '';
                bairroInput.value = '';
            } else {
                ruaInput.value = data.logradouro;
                bairroInput.value = data.bairro;
                numeroInput.focus();
            }
        } catch (error) {
            console.error("Erro ao buscar CEP:", error);
            alert('Não foi possível buscar o endereço.');
        } finally {
            validateCheckoutButton();
        }
    };

    const loadSavedAddress = async () => {
        const userId = sessionStorage.getItem('userId');
        if (!userId) return;
        try {
            const userRef = doc(firestore, "users", userId);
            const docSnap = await getDoc(userRef);
            if (docSnap.exists() && docSnap.data().savedAddress) {
                const address = docSnap.data().savedAddress;
                cepInput.value = address.cep || '';
                ruaInput.value = address.rua || '';
                numeroInput.value = address.numero || '';
                bairroInput.value = address.bairro || '';
                complementoInput.value = address.complemento || '';
                saveAddressCheckbox.checked = true;
                validateCheckoutButton();
            }
        } catch (error) {
            console.error("Erro ao carregar endereço salvo:", error);
        }
    };

    const renderCart = () => {
        const cart = JSON.parse(localStorage.getItem('pizzariaCart')) || {};
        const activeOferta = JSON.parse(sessionStorage.getItem('activeOferta'));
        
        cartItemsContainer.innerHTML = '';
        const existingOfertaBox = document.querySelector('.oferta-info-box');
        if (existingOfertaBox) existingOfertaBox.remove();

        if (activeOferta) {
            const ofertaInfoBox = document.createElement('div');
            ofertaInfoBox.className = 'oferta-info-box';
            ofertaInfoBox.innerHTML = `
                <div class="oferta-info-content">
                    <i class="material-icons">local_offer</i>
                    <div>
                        <h4>Você está aproveitando a oferta "${activeOferta.nome}"!</h4>
                        <p>Os itens abaixo fazem parte do combo com preço especial.</p>
                    </div>
                </div>
                <button id="remove-oferta-btn" class="remove-item-btn" title="Remover oferta do carrinho">
                    <i class="material-icons">delete_forever</i>
                </button>
            `;
            cartItemsContainer.insertAdjacentElement('beforebegin', ofertaInfoBox);
            document.getElementById('remove-oferta-btn').addEventListener('click', removeOferta);
        }

        if (Object.keys(cart).length === 0) {
            sessionStorage.removeItem('activeOferta');
            
            cartItemsContainer.style.display = 'flex';
            cartItemsContainer.style.justifyContent = 'center';
            cartItemsContainer.style.alignItems = 'center';
            cartItemsContainer.style.minHeight = '250px';

            cartItemsContainer.innerHTML = `
                <div class="empty-cart-message-container" style="display: flex; flex-direction: column; align-items: center; gap: 16px; color: #555;">
                    <p style="font-size: 1.1rem; margin-bottom: 10px;">Seu carrinho está vazio.</p>
                    <div class="empty-cart-actions">
                         <a href="cardapio.html" class="btn btn-primary">Voltar ao Cardápio</a>
                    </div>
                </div>
            `;
        } else {
            cartItemsContainer.style.display = '';
            cartItemsContainer.style.justifyContent = '';
            cartItemsContainer.style.alignItems = '';
            cartItemsContainer.style.minHeight = '';

            for (const id in cart) {
                const item = cart[id];
                const itemCard = document.createElement('div');
                itemCard.className = 'cart-item-card'; 
                itemCard.dataset.id = id;

                const priceHtml = activeOferta ? '' : `<p class="cart-item-price">${formatCurrency(item.preco)}</p>`;
                const controlsDisabled = activeOferta ? 'disabled' : '';
                const removeBtnStyle = activeOferta ? 'style="display: none;"' : '';
                
                itemCard.innerHTML = `
                    <img src="${item.img || 'img/desenho-pizza.png'}" alt="${item.nome}" class="cart-item-image">
                    <div class="cart-item-details">
                        <h3>${item.nome}</h3>
                        ${priceHtml} 
                        <div class="cart-item-quantity-controls">
                            <button class="quantity-btn decrease-btn" aria-label="Diminuir quantidade" ${controlsDisabled}>-</button>
                            <span>${item.quantidade}</span>
                            <button class="quantity-btn increase-btn" aria-label="Aumentar quantidade" ${controlsDisabled}>+</button>
                        </div>
                    </div>
                    <button class="remove-item-btn" aria-label="Remover item" ${removeBtnStyle}>
                        <i class="material-icons">delete_outline</i>
                    </button>
                `;
                cartItemsContainer.appendChild(itemCard);
            }
        }
        
        updateSummary();
        updateCartBadge();
        validateCheckoutButton();
    };

    const updateSummary = () => {
        let subtotal;
        const activeOferta = JSON.parse(sessionStorage.getItem('activeOferta'));
        const appliedCoupon = JSON.parse(sessionStorage.getItem('appliedCoupon'));

        if (activeOferta) {
            subtotal = activeOferta.precoFinal;
            couponInput.disabled = true;
            applyCouponBtn.disabled = true;
            couponInput.placeholder = "Oferta já aplicada";
            if (appliedCoupon) removeCoupon();
        } else {
            const cart = JSON.parse(localStorage.getItem('pizzariaCart')) || {};
            subtotal = Object.values(cart).reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
            couponInput.disabled = false;
            applyCouponBtn.disabled = false;
            couponInput.placeholder = "Possui um cupom?";
        }

        let discountAmount = 0;
        if (appliedCoupon && subtotal > 0 && !activeOferta) {
            discountAmount = subtotal * (appliedCoupon.desconto / 100);
            appliedCouponRow.style.display = 'flex';
            couponCodeDisplay.textContent = appliedCoupon.codigo;
            discountAmountEl.textContent = `- ${formatCurrency(discountAmount)}`;
        } else {
            appliedCouponRow.style.display = 'none';
            if (subtotal === 0) sessionStorage.removeItem('appliedCoupon');
        }

        const serviceFee = 1.00; 
        const deliveryFee = 0.00;
        const grandTotal = subtotal - discountAmount + serviceFee + deliveryFee;

        subtotalEl.textContent = formatCurrency(subtotal);
        deliveryFeeEl.textContent = formatCurrency(deliveryFee);
        grandTotalEl.textContent = formatCurrency(grandTotal > 0 ? grandTotal : 0);
    };
    
    function removeOferta() {
        if (confirm("Tem certeza que deseja remover esta oferta do carrinho?")) {
            localStorage.removeItem('pizzariaCart');
            sessionStorage.removeItem('activeOferta');
            window.location.reload();
        }
    }

    function clearOfertaIfCartChanges() {
        const activeOferta = sessionStorage.getItem('activeOferta');
        if (activeOferta) {
            sessionStorage.removeItem('activeOferta');
            window.location.reload(); 
        }
    }

    const applyCoupon = async () => {
        const code = couponInput.value.trim(); // Não precisa mais do toUpperCase() aqui
        if (!code) {
            couponFeedbackEl.textContent = 'Por favor, insira um código.';
            couponFeedbackEl.className = 'coupon-feedback-message error';
            return;
        }

        applyCouponBtn.disabled = true;
        applyCouponBtn.textContent = '...';
        couponFeedbackEl.textContent = '';
        couponFeedbackEl.className = 'coupon-feedback-message';

        try {
            const q = query(collection(firestore, "cupons_promocionais"), where("codigo", "==", code));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                couponFeedbackEl.textContent = 'Cupom inválido ou não encontrado.';
                couponFeedbackEl.className = 'coupon-feedback-message error';
                sessionStorage.removeItem('appliedCoupon');
                return;
            }

            const couponDoc = querySnapshot.docs[0];
            const couponData = { id: couponDoc.id, ...couponDoc.data() };
            const today = new Date().toISOString().split('T')[0];

            if (!couponData.ativa) {
                couponFeedbackEl.textContent = 'Este cupom não está mais ativo.';
                couponFeedbackEl.className = 'coupon-feedback-message error';
                sessionStorage.removeItem('appliedCoupon');
            } else if (couponData.dataValidade < today) {
                couponFeedbackEl.textContent = 'Este cupom expirou.';
                couponFeedbackEl.className = 'coupon-feedback-message error';
                sessionStorage.removeItem('appliedCoupon');
            } else {
                sessionStorage.setItem('appliedCoupon', JSON.stringify(couponData));
                couponFeedbackEl.textContent = `Cupom de ${couponData.desconto}% aplicado com sucesso!`;
                couponFeedbackEl.className = 'coupon-feedback-message success';
                couponInput.value = '';
            }
        } catch (error) {
            console.error("Erro ao aplicar cupom:", error);
            couponFeedbackEl.textContent = 'Erro ao verificar o cupom. Tente novamente.';
            couponFeedbackEl.className = 'coupon-feedback-message error';
        } finally {
            applyCouponBtn.disabled = false;
            applyCouponBtn.textContent = 'Aplicar';
            updateSummary();
        }
    };

    const removeCoupon = () => {
        sessionStorage.removeItem('appliedCoupon');
        couponFeedbackEl.textContent = '';
        couponFeedbackEl.className = 'coupon-feedback-message';
        updateSummary();
    };

    const updateItemQuantity = (productId, change) => {
        clearOfertaIfCartChanges();
        const cart = JSON.parse(localStorage.getItem('pizzariaCart')) || {};
        if (cart[productId]) {
            cart[productId].quantidade += change;
            if (cart[productId].quantidade <= 0) {
                delete cart[productId];
            }
        }
        localStorage.setItem('pizzariaCart', JSON.stringify(cart));
        renderCart();
    };

    const removeItem = (productId) => {
        clearOfertaIfCartChanges();
        const cart = JSON.parse(localStorage.getItem('pizzariaCart')) || {};
        if (cart[productId]) {
            delete cart[productId];
        }
        localStorage.setItem('pizzariaCart', JSON.stringify(cart));
        renderCart();
    };

    // --- EVENT LISTENERS ---
    applyCouponBtn.addEventListener('click', applyCoupon);
    removeCouponBtn.addEventListener('click', removeCoupon);

    // =========================================================================
    //  INÍCIO DA ATUALIZAÇÃO: Converte o texto do cupom para maiúsculas
    // =========================================================================
    couponInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
    });
    // =========================================================================
    //  FIM DA ATUALIZAÇÃO
    // =========================================================================

    cartItemsContainer.addEventListener('click', (e) => {
        const itemCard = e.target.closest('.cart-item-card');
        if (!itemCard) return;
        const productId = itemCard.dataset.id;

        if (e.target.closest('.increase-btn')) { updateItemQuantity(productId, 1); }
        else if (e.target.closest('.decrease-btn')) { updateItemQuantity(productId, -1); }
        else if (e.target.closest('.remove-item-btn')) { removeItem(productId); }
    });

    cepInput.addEventListener('input', (event) => {
        let cepValue = event.target.value.replace(/\D/g, '');
        cepValue = cepValue.replace(/^(\d{5})(\d)/, '$1-$2');
        event.target.value = cepValue;
        if (cepValue.length === 9) {
            fetchAddressFromCep(cepValue.replace('-', ''));
        }
        validateCheckoutButton();
    });
    
    [ruaInput, numeroInput, bairroInput].forEach(input => {
        input.addEventListener('input', validateCheckoutButton);
    });

    checkoutButton.addEventListener('click', async () => {
        const grandTotalText = grandTotalEl.textContent;
        const grandTotalValue = parseFloat(grandTotalText.replace(/[^\d,.]/g, '').replace(',', '.'));
        
        const addressData = {
            cep: cepInput.value,
            rua: ruaInput.value,
            numero: numeroInput.value,
            bairro: bairroInput.value,
            complemento: complementoInput.value,
        };
        
        const userId = sessionStorage.getItem('userId');
        if (userId) {
            const userRef = doc(firestore, "users", userId);
            try {
                if (saveAddressCheckbox.checked) {
                    await updateDoc(userRef, { savedAddress: addressData });
                } else {
                    await updateDoc(userRef, { savedAddress: deleteField() });
                }
            } catch (error) {
                console.error("Erro ao salvar/remover endereço:", error);
            }
        }
        
        sessionStorage.setItem('pizzariaOrderTotal', grandTotalValue);
        sessionStorage.setItem('pizzariaOrderAddress', JSON.stringify(addressData));
        window.location.href = 'pagamentos.html';
    });

    // --- INICIALIZAÇÃO ---
    renderCart();
    loadSavedAddress();
});