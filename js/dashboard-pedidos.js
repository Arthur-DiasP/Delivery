// js/dashboard-pedidos.js

import { firestore } from './firebase-config.js';
// ALTERAÇÃO: Importando 'onSnapshot' para escutar em tempo real.
import { collection, onSnapshot, orderBy, query, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- SELETORES GLOBAIS DO MÓDULO ---
const ordersListElement = document.getElementById('all-orders-list');
const filterButtonsContainer = document.getElementById('pedidos-filter-buttons');
const mapsModalOverlay = document.getElementById('maps-modal-overlay');
const mapsModalAddress = document.getElementById('maps-modal-address');
const googleMapsLink = document.getElementById('google-maps-link');
const wazeLink = document.getElementById('waze-link');
const closeModalBtn = document.getElementById('close-maps-modal-btn');

// --- ESTADO GLOBAL DO MÓDULO ---
let allOrders = []; // Armazena todos os pedidos para filtragem rápida

/**
 * Lida com a alteração do status de um pedido no Firestore.
 * (Esta função não precisa de alterações)
 */
async function handleStatusChange(event) {
    const target = event.target;
    if (target.classList.contains('status-selector')) {
        const orderCard = target.closest('.order-card');
        const orderId = orderCard.dataset.orderId;
        const newStatus = target.value;
        const feedbackEl = orderCard.querySelector('.status-saved-feedback');

        if (!orderId) {
            console.error("ID do pedido não encontrado.");
            return;
        }

        try {
            const orderRef = doc(firestore, "pedidos", orderId);
            const updateData = { status: newStatus };
            
            if (newStatus === 'Cancelado') {
                updateData.canceladoEm = serverTimestamp();
            }

            await updateDoc(orderRef, updateData);
            
            feedbackEl.textContent = 'Salvo!';
            feedbackEl.style.opacity = '1';
            setTimeout(() => { feedbackEl.style.opacity = '0'; }, 2000);

            // A atualização via onSnapshot cuidará de re-renderizar,
            // mas podemos forçar uma atualização local para feedback instantâneo.
            const orderIndex = allOrders.findIndex(order => order.id === orderId);
            if(orderIndex > -1) {
                allOrders[orderIndex].status = newStatus;
                const activeFilter = filterButtonsContainer.querySelector('.filter-btn.active').dataset.status;
                renderFilteredOrders(activeFilter);
            }

        } catch (error) {
            console.error("Erro ao atualizar o status do pedido:", error);
            feedbackEl.textContent = 'Erro!';
            feedbackEl.style.opacity = '1';
        }
    }
}

/**
 * Funções para o modal de rotas e cliques no card.
 * (Estas funções não precisam de alterações)
 */
function openMapsModal(address) {
    const addressString = `${address.rua}, ${address.numero} - ${address.bairro}, ${address.cep}`;
    const encodedAddress = encodeURIComponent(addressString);
    mapsModalAddress.textContent = addressString;
    googleMapsLink.href = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
    wazeLink.href = `https://waze.com/ul?q=${encodedAddress}&navigate=yes`;
    mapsModalOverlay.classList.add('visible');
}

function handleOrderCardClick(event) {
    const target = event.target;
    const button = target.closest('.toggle-details-btn');
    const addressEl = target.closest('.address-clickable');
    if (button) {
        const details = button.nextElementSibling;
        const icon = button.querySelector('i');
        details.classList.toggle('hidden');
        button.classList.toggle('is-open');
        icon.textContent = details.classList.contains('hidden') ? 'expand_more' : 'expand_less';
    }
    if (addressEl) {
        const orderId = addressEl.closest('.order-card').dataset.orderId;
        const order = allOrders.find(o => o.id === orderId);
        if (order && order.endereco) {
            openMapsModal(order.endereco);
        }
    }
}

/**
 * Renderiza os pedidos filtrados na tela.
 * (Esta função não precisa de alterações)
 */
function renderFilteredOrders(statusFilter) {
    ordersListElement.innerHTML = '';
    const filtered = allOrders.filter(order => statusFilter === 'todos' || order.status === statusFilter);

    if (filtered.length === 0) {
        ordersListElement.innerHTML = '<p>Nenhum pedido encontrado para este status.</p>';
        return;
    }

    filtered.forEach((pedidoData) => {
        const pedido = pedidoData;
        const orderId = pedido.id;
        const pedidoCard = document.createElement('div');
        pedidoCard.className = 'order-card';
        pedidoCard.dataset.orderId = orderId;
        const date = pedido.data ? pedido.data.toDate() : new Date();
        const formattedDate = date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR').substring(0, 5);
        const itemsListHtml = Object.values(pedido.itens || {}).map(item => {
            let customizationsHtml = '';
            if (item.personalizacoes) {
                const { removidos, adicionados, observacao } = item.personalizacoes;
                const details = [];
                if (removidos && removidos.length > 0) { details.push(`<span class="detail-removido">- Sem ${removidos.join(', ')}</span>`); }
                if (adicionados && adicionados.length > 0) { details.push(`<span class="detail-adicionado">+ ${adicionados.map(a => a.nome).join(', ')}</span>`); }
                if (observacao) { details.push(`<span class="detail-obs">Obs: ${observacao}</span>`); }
                if (details.length > 0) { customizationsHtml = `<div class="item-customizations-details">${details.join('')}</div>`; }
            }
            return `<li><strong>${item.quantidade}x ${item.nome}</strong>${customizationsHtml}</li>`;
        }).join('');
        pedidoCard.innerHTML = `
            <div class="card-header">
                <div class="card-title">
                    <span class="order-id">#${orderId.substring(0, 8)}</span>
                    <h4 class="client-name">${pedido.cliente?.nome || 'Cliente Não Identificado'}</h4>
                </div>
                <div class="card-status">
                    <select class="status-selector">
                        <option value="Pagamento Pendente" ${pedido.status === 'Pagamento Pendente' ? 'selected' : ''}>Pendente</option>
                        <option value="Concluído" ${pedido.status === 'Concluído' ? 'selected' : ''}>Concluído</option>
                        <option value="Cancelado" ${pedido.status === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
                    </select>
                    <span class="status-saved-feedback"></span>
                </div>
            </div>
            <div class="card-body">
                <p class="order-info"><strong>Total:</strong> R$ ${pedido.total ? pedido.total.toFixed(2).replace('.', ',') : '0,00'}</p>
                <p class="order-info"><strong>Data:</strong> ${formattedDate}</p>
                <p class="order-info address-clickable" title="Clique para ver no mapa"><strong>Endereço:</strong> ${pedido.endereco.rua}, ${pedido.endereco.numero} - ${pedido.endereco.bairro}</p>
                <p class="order-info"><strong>Pagamento:</strong> ${pedido.formaPagamento || 'Não informado'}</p>
                <button class="toggle-details-btn"><i class="material-icons">expand_more</i> Ver Itens</button>
                <div class="order-items-details hidden">
                    <h4>Itens do Pedido:</h4>
                    <ul class="items-list">${itemsListHtml}</ul>
                </div>
            </div>
        `;
        ordersListElement.appendChild(pedidoCard);
    });
}

export function init() {
    console.log("Iniciando módulo de Pedidos do Dashboard com listener em tempo real...");
    ordersListElement.innerHTML = '<p>Carregando histórico de pedidos...</p>';
    
    // Configura os event listeners uma única vez
    ordersListElement.addEventListener('change', handleStatusChange);
    ordersListElement.addEventListener('click', handleOrderCardClick);
    filterButtonsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
            filterButtonsContainer.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            renderFilteredOrders(e.target.dataset.status);
        }
    });
    closeModalBtn.addEventListener('click', () => mapsModalOverlay.classList.remove('visible'));
    mapsModalOverlay.addEventListener('click', (e) => {
        if(e.target === mapsModalOverlay) {
            mapsModalOverlay.classList.remove('visible');
        }
    });

    // =========================================================================
    //  ALTERAÇÃO PRINCIPAL: Troca de getDocs por onSnapshot
    // =========================================================================
    try {
        const q = query(collection(firestore, "pedidos"), orderBy("data", "desc"));
        
        // onSnapshot "escuta" a query. A função de callback será executada
        // imediatamente com os dados iniciais e, depois, toda vez que
        // os dados que correspondem à query mudarem (novo pedido, status alterado, etc).
        onSnapshot(q, (querySnapshot) => {
            console.log("Recebida atualização da lista de pedidos...");
            
            // A cada atualização, reconstruímos o array 'allOrders' com os dados mais recentes.
            allOrders = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Re-renderizamos a lista, respeitando o filtro que já está selecionado na tela.
            const activeFilter = filterButtonsContainer.querySelector('.filter-btn.active').dataset.status;
            renderFilteredOrders(activeFilter);

        }, (error) => {
            // Callback para tratar erros do listener
            console.error("Erro ao escutar mudanças nos pedidos:", error);
            ordersListElement.innerHTML = '<p>Erro ao carregar o histórico em tempo real.</p>';
        });

    } catch (error) {
        console.error("Erro ao configurar o listener de pedidos:", error);
        ordersListElement.innerHTML = '<p>Erro ao iniciar a busca por pedidos.</p>';
    }
}