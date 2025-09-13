// js/cardapio.js

import { firestore } from './firebase-config.js';
// A importação de 'where', 'limit' e 'query' não é mais necessária para as ofertas, tornando o código mais simples.
import { collection, onSnapshot, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { updateCartBadge } from './main.js';

const formatCurrency = (value) => `R$ ${Number(value).toFixed(2).replace('.', ',')}`;

const stringToHash = str => {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash &= hash;
    }
    return Math.abs(hash);
};

// --- LÓGICA DO CARROSSEL DE ANÚNCIOS (Inalterada) ---
const bannerContainer = document.getElementById('banner-slider-container');
const slidesContainer = document.querySelector('.banner-slides');
const dotsContainer = document.querySelector('.banner-dots');
const progressBar = document.querySelector('.banner-progress-bar');
let bannerInterval;
const SLIDE_DURATION = 5000;

function renderBanners(banners) {
    if (!bannerContainer || !slidesContainer || !dotsContainer || banners.length === 0) {
        if (bannerContainer) bannerContainer.style.display = 'none';
        return;
    }
    slidesContainer.innerHTML = '';
    dotsContainer.innerHTML = '';
    banners.forEach((banner, index) => {
        const slide = document.createElement('div');
        slide.className = 'banner-slide';
        let mediaElement = banner.mediaType === 'video' ? `<video src="${banner.mediaUrl}" autoplay muted loop playsinline></video>` : `<img src="${banner.mediaUrl}" alt="Anúncio ${index + 1}">`;
        slide.innerHTML = banner.linkUrl ? `<a href="${banner.linkUrl}" target="_blank" rel="noopener noreferrer">${mediaElement}</a>` : mediaElement;
        slidesContainer.appendChild(slide);
        const dot = document.createElement('button');
        dot.className = 'banner-dot';
        dot.dataset.index = index;
        dotsContainer.appendChild(dot);
    });
    bannerContainer.style.display = 'block';
    startSlider(banners.length);
}

function startSlider(numSlides) {
    let currentIndex = 0;
    const dots = document.querySelectorAll('.banner-dot');
    function showSlide(index) {
        slidesContainer.style.transform = `translateX(-${index * 100}%)`;
        dots.forEach(dot => dot.classList.remove('active'));
        if (dots[index]) dots[index].classList.add('active');
        if (progressBar) {
            progressBar.style.animation = 'none';
            void progressBar.offsetWidth;
            progressBar.style.animation = `progressBarAnimation ${SLIDE_DURATION / 1000}s linear forwards`;
        }
    }
    function nextSlide() {
        currentIndex = (currentIndex + 1) % numSlides;
        showSlide(currentIndex);
    }
    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            clearInterval(bannerInterval);
            currentIndex = parseInt(dot.dataset.index);
            showSlide(currentIndex);
            bannerInterval = setInterval(nextSlide, SLIDE_DURATION);
        });
    });
    showSlide(0);
    clearInterval(bannerInterval);
    if (numSlides > 1) {
        bannerInterval = setInterval(nextSlide, SLIDE_DURATION);
    }
}

function listenToBanners() {
    onSnapshot(collection(firestore, 'banners'), (snapshot) => {
        renderBanners(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
        console.error("Erro ao buscar banners:", error);
        if (bannerContainer) bannerContainer.style.display = 'none';
    });
}


// --- LÓGICA DA SEÇÃO DE OFERTAS ---
const ofertasSection = document.getElementById('ofertas-section');
let countdownInterval;

// =========================================================================
//  INÍCIO DA CORREÇÃO: Função listenToOfertas simplificada
// =========================================================================
/**
 * Busca TODAS as ofertas e filtra no código para encontrar a mais relevante.
 * Isso remove a necessidade de um índice composto no Firestore.
 */
function listenToOfertas() {
    if (!ofertasSection) return;

    // 1. Busca a coleção inteira, sem filtros complexos.
    onSnapshot(collection(firestore, "ofertas"), (snapshot) => {
        const now = new Date();
        
        // 2. Mapeia e filtra as ofertas ativas e válidas no JavaScript
        const activeOfertas = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(oferta => 
                oferta.ativo === true &&
                oferta.expiraEm && // Garante que o campo existe
                oferta.expiraEm.toDate() > now // Compara com a data/hora atual
            );

        if (activeOfertas.length > 0) {
            // Opcional: Ordena para mostrar a que expira por último, se houver várias
            activeOfertas.sort((a, b) => b.expiraEm.toMillis() - a.expiraEm.toMillis());
            
            // 3. Exibe a primeira oferta válida encontrada
            displayOferta(activeOfertas[0]);
        } else {
            // Se não houver nenhuma oferta válida, esconde a seção
            ofertasSection.style.display = 'none';
            clearInterval(countdownInterval);
        }
    }, (error) => {
        console.error("Erro ao buscar ofertas:", error);
        ofertasSection.style.display = 'none';
    });
}
// =========================================================================
//  FIM DA CORREÇÃO
// =========================================================================

function displayOferta(oferta) {
    // Calcula o preço original com base na lista de produtos já carregada
    const precoOriginal = oferta.produtos.reduce((total, productId) => {
        const product = allProducts.find(p => p.id === productId);
        return total + (product ? product.preco : 0);
    }, 0);

    // Se o preço original for 0, é provável que os produtos ainda não carregaram.
    // Isso é um failsafe, mas a lógica de chamada corrigida deve prevenir isso.
    if (precoOriginal === 0) {
        console.warn("Preço original da oferta calculado como 0. Produtos podem não ter sido carregados a tempo.");
        ofertasSection.style.display = 'none';
        return;
    }

    document.getElementById('oferta-imagem').src = oferta.imagemUrl;
    document.getElementById('oferta-nome').textContent = oferta.nome;
    document.getElementById('oferta-descricao').textContent = oferta.descricao;
    document.getElementById('oferta-preco-original').textContent = `de ${formatCurrency(precoOriginal)}`;
    document.getElementById('oferta-preco-final').textContent = `por ${formatCurrency(oferta.precoOferta)}`;
    ofertasSection.style.display = 'block';
    startCountdown(oferta.expiraEm);
    document.getElementById('oferta-add-btn').onclick = () => addOfertaToCart(oferta);
}

function addOfertaToCart(oferta) {
    if (!confirm("Esta oferta substituirá todos os itens do seu carrinho. Deseja continuar?")) {
        return;
    }
    const newCart = {};
    oferta.produtos.forEach(productId => {
        const product = allProducts.find(p => p.id === productId);
        if (product) {
            if (newCart[productId]) {
                newCart[productId].quantidade += 1;
            } else {
                newCart[productId] = {
                    nome: product.nome,
                    preco: product.preco,
                    quantidade: 1,
                    img: product.imagemUrl
                };
            }
        }
    });
    localStorage.setItem('pizzariaCart', JSON.stringify(newCart));
    sessionStorage.setItem('activeOferta', JSON.stringify({
        id: oferta.id,
        nome: oferta.nome,
        precoFinal: oferta.precoOferta
    }));
    window.location.href = 'carrinho.html';
}

function startCountdown(expirationTimestamp) {
    clearInterval(countdownInterval);
    const countdownElement = document.getElementById('oferta-countdown');
    const expirationDate = expirationTimestamp.toDate();
    countdownInterval = setInterval(() => {
        const distance = expirationDate - new Date().getTime();
        if (distance < 0) {
            clearInterval(countdownInterval);
            countdownElement.innerHTML = "<span>OFERTA ENCERRADA</span>";
            ofertasSection.style.display = 'none';
            return;
        }
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        countdownElement.innerHTML = `
            <span>Termina em:</span>
            <div class="timer-box">${days}<span>d</span></div>
            <div class="timer-box">${hours}<span>h</span></div>
            <div class="timer-box">${minutes}<span>m</span></div>
            <div class="timer-box">${seconds}<span>s</span></div>
        `;
    }, 1000);
}

let allProducts = [];

document.addEventListener('DOMContentLoaded', () => {
    // --- SELETORES DO DOM ---
    const productListContainer = document.getElementById('product-list');
    const searchInput = document.getElementById('search-input');
    const filterButtonsContainer = document.querySelector('.filter-buttons');
    const customizationOverlay = document.getElementById('customization-overlay');
    const modalAddToCartBtn = document.getElementById('modal-add-to-cart-btn');
    const closeCustomizationBtn = document.getElementById('close-customization-btn');
    const modalImg = document.getElementById('modal-product-img');
    const modalName = document.getElementById('modal-product-name');
    const modalIngredients = document.getElementById('modal-product-ingredients');
    const modalBasePrice = document.getElementById('modal-product-base-price');
    const modalRemovableOptions = document.getElementById('modal-removable-options');
    const modalAdditionalOptions = document.getElementById('modal-additional-options');
    const modalInstructions = document.getElementById('modal-special-instructions');
    const modalDecreaseQty = document.getElementById('modal-decrease-qty');
    const modalIncreaseQty = document.getElementById('modal-increase-qty');
    const modalQty = document.getElementById('modal-product-qty');
    const modalFinalPrice = document.getElementById('modal-final-price');
    const finalizeOrderContainer = document.getElementById('finalize-order-container');

    // --- ESTADO DO APP ---
    let cart = JSON.parse(localStorage.getItem('pizzariaCart')) || {};
    let currentProduct = null;
    let personalizationConfig = { lista: {}, aplicacoes: {} };

    function updateFinalizeButtonVisibility() {
        const hasItems = Object.keys(cart).length > 0;
        if (finalizeOrderContainer) {
            finalizeOrderContainer.classList.toggle('visible', hasItems);
        }
    }
    
    function listenToProducts() {
        onSnapshot(collection(firestore, 'produtos'), (snapshot) => {
            allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderProducts();
            listenToOfertas(); // Chamada movida para cá para evitar race condition
        });
    }

    function listenToPersonalizationConfig() {
        onSnapshot(collection(firestore, 'personalizacoes'), (snapshot) => {
            const newList = {};
            const newApplications = { todasPizzas: {}, todasEsfihas: {} };
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                newList[doc.id] = { nome: data.nome, preco: data.preco };
                if (data.aplicaPizza || data.aplicaTodos) newApplications.todasPizzas[doc.id] = true;
                if (data.aplicaEsfiha || data.aplicaTodos) newApplications.todasEsfihas[doc.id] = true;
            });
            personalizationConfig = { lista: newList, aplicacoes: newApplications };
        });
    }

    function renderProducts() {
        const activeCategory = document.querySelector('.filter-btn.active')?.dataset.category || 'all';
        const searchTerm = searchInput.value.toLowerCase();
        let productsToRender = allProducts.filter(p => (activeCategory === 'all' || p.categoria === activeCategory) &&
            ((p.nome?.toLowerCase().includes(searchTerm)) || (p.ingredientes?.toLowerCase().includes(searchTerm))));
        
        productListContainer.innerHTML = productsToRender.length === 0 ? '<p>Nenhum produto encontrado.</p>' : '';
        
        productsToRender.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';
            const buttonText = product.categoria === 'bebida' ? 'Adicionar' : 'Personalizar';
            card.innerHTML = `<img src="${product.imagemUrl || 'img/desenho-pizza.png'}" alt="${product.nome}"> <div class="product-info"> <h3>${product.nome}</h3> <h4>${product.ingredientes || ''}</h4> </div> <div class="product-price"> <h5>${formatCurrency(product.preco)}</h5> <button class="add-button" data-id="${product.id}">${buttonText}</button> </div>`;
            productListContainer.appendChild(card);
        });
    }

    function updateModalPrice() {
        if (!currentProduct) return;
        let finalPrice = parseFloat(currentProduct.preco);
        document.querySelectorAll('#modal-additional-options input:checked').forEach(input => {
            finalPrice += parseFloat(input.dataset.price);
        });
        modalFinalPrice.textContent = formatCurrency(finalPrice * parseInt(modalQty.textContent));
    }

    function openCustomizationModal(product) {
        currentProduct = product;
        modalImg.src = product.imagemUrl || 'img/desenho-pizza.png';
        modalName.textContent = product.nome;
        modalIngredients.textContent = product.ingredientes || '';
        modalBasePrice.textContent = formatCurrency(product.preco);
        modalInstructions.value = '';
        modalQty.textContent = '1';
        
        const { lista, aplicacoes } = personalizationConfig;
        let removableHtml = '', additionalHtml = '';
        if (product.personalizacoes?.removiveis?.length > 0) {
            removableHtml = '<h3>Remover Ingredientes</h3>';
            product.personalizacoes.removiveis.forEach(item => { removableHtml += `<label class="checkbox-label"><input type="checkbox" value="${item}"> ${item}</label>`; });
        }
        
        const finalAdicionais = new Map();
        const addOptions = (ids) => { if(ids) Object.keys(ids).forEach(id => { if (lista[id]) finalAdicionais.set(id, lista[id]); }); };
        if (product.categoria === 'pizza') addOptions(aplicacoes.todasPizzas);
        if (product.categoria === 'esfiha') addOptions(aplicacoes.todasEsfihas);

        if (finalAdicionais.size > 0) {
            additionalHtml = '<h3>Adicionais</h3>';
            Array.from(finalAdicionais.values()).sort((a,b) => a.nome.localeCompare(b.nome)).forEach(item => {
                const priceText = item.preco > 0 ? `<span>+ ${formatCurrency(item.preco)}</span>` : `<span>Grátis</span>`;
                additionalHtml += `<label class="checkbox-label"><input type="checkbox" data-price="${item.preco}" value="${item.nome}"> ${item.nome} ${priceText}</label>`;
            });
        }
        modalRemovableOptions.innerHTML = removableHtml;
        modalAdditionalOptions.innerHTML = additionalHtml;
        
        updateModalPrice();
        customizationOverlay.classList.add('visible');
    }
    
    function closeCustomizationModal() {
        customizationOverlay.classList.remove('visible');
        currentProduct = null;
    }

    function addToCart(product, isPersonalized) {
        sessionStorage.removeItem('activeOferta');
        
        let cartItemId, itemData;
        const quantidade = isPersonalized ? parseInt(modalQty.textContent) : 1;
        const customizations = isPersonalized ? {
            removidos: Array.from(document.querySelectorAll('#modal-removable-options input:checked')).map(cb => cb.value),
            adicionados: Array.from(document.querySelectorAll('#modal-additional-options input:checked')).map(cb => ({ nome: cb.value, preco: parseFloat(cb.dataset.price) })),
            observacao: modalInstructions.value.trim()
        } : null;
        const hasCustomizations = customizations && (customizations.removidos.length > 0 || customizations.adicionados.length > 0 || customizations.observacao);
        const precoFinalUnitario = isPersonalized ? parseFloat(modalFinalPrice.textContent.replace(/[^\d,]/g, '').replace(',', '.')) / quantidade : product.preco;
        cartItemId = hasCustomizations ? `${product.id}-${stringToHash(JSON.stringify(customizations))}` : product.id;

        itemData = {
            nome: hasCustomizations ? `${product.nome} (Personalizada)` : product.nome,
            preco: precoFinalUnitario,
            quantidade: 0,
            img: product.imagemUrl,
            personalizacoes: hasCustomizations ? customizations : null
        };

        if (cart[cartItemId]) {
            cart[cartItemId].quantidade += quantidade;
        } else {
            cart[cartItemId] = itemData;
            cart[cartItemId].quantidade = quantidade;
        }
        
        localStorage.setItem('pizzariaCart', JSON.stringify(cart));
        updateCartBadge();
        updateFinalizeButtonVisibility();
        alert(`${quantidade}x ${itemData.nome} adicionado(s) ao carrinho!`);
        
        if (isPersonalized) closeCustomizationModal();
    }

    // --- EVENT LISTENERS ---
    filterButtonsContainer.addEventListener('click', (e) => {
        if (e.target.closest('.filter-btn')) {
            filterButtonsContainer.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            e.target.closest('.filter-btn').classList.add('active');
            renderProducts();
        }
    });

    searchInput.addEventListener('input', renderProducts);

    productListContainer.addEventListener('click', (e) => {
        const addButton = e.target.closest('.add-button');
        if (!addButton) return;
        const product = allProducts.find(p => p.id === addButton.dataset.id);
        if (!product) return;
        product.categoria !== 'bebida' ? openCustomizationModal(product) : addToCart(product, false);
    });

    modalAddToCartBtn.addEventListener('click', () => { if (currentProduct) addToCart(currentProduct, true); });
    closeCustomizationBtn.addEventListener('click', closeCustomizationModal);
    customizationOverlay.addEventListener('click', (e) => { if (e.target === customizationOverlay) closeCustomizationModal(); });
    modalDecreaseQty.addEventListener('click', () => { let qty = parseInt(modalQty.textContent); if (qty > 1) { modalQty.textContent = qty - 1; updateModalPrice(); } });
    modalIncreaseQty.addEventListener('click', () => { modalQty.textContent = parseInt(modalQty.textContent) + 1; updateModalPrice(); });
    modalAdditionalOptions.addEventListener('change', updateModalPrice);

    // --- INICIALIZAÇÃO ---
    listenToBanners();
    listenToPersonalizationConfig();
    listenToProducts(); // Esta função agora também chama listenToOfertas internamente, após os produtos serem carregados.
    updateFinalizeButtonVisibility();
});