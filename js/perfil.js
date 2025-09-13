// js/perfil.js

import { firestore } from './firebase-config.js';
import { doc, getDoc, updateDoc, collection, query, where, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    // --- SELETORES DO DOM ---
    const userNameEl = document.getElementById('profile-user-name');
    const form = document.getElementById('profile-form');
    const nomeInput = document.getElementById('profile-nome');
    const emailInput = document.getElementById('profile-email');
    const telefoneInput = document.getElementById('profile-telefone');
    const nascimentoInput = document.getElementById('profile-nascimento');
    const cpfInput = document.getElementById('profile-cpf');
    const editBtn = document.getElementById('edit-profile-btn');
    const saveBtn = document.getElementById('save-profile-btn');
    const orderHistoryList = document.getElementById('order-history-list');

    // --- VARIÁVEIS GLOBAIS ---
    let userData = null;

    // --- VALIDAÇÃO DE SESSÃO ---
    const userId = sessionStorage.getItem('userId');
    if (!userId) {
        alert('Você precisa estar logado para ver seu perfil.');
        window.location.href = 'login.html';
        return;
    }

    telefoneInput.addEventListener('input', (e) => {
        if (e.target.readOnly) return;
        let value = e.target.value.replace(/\D/g, '');
        value = value.slice(0, 13);
        value = value.replace(/^(\d{2})/, '+$1 ');
        value = value.replace(/\+(\d{2})\s(\d{2})/, '+$1 ($2) ');
        value = value.replace(/(\d{5})(\d)/, '$1-$2');
        e.target.value = value;
    });

    // --- CARREGAMENTO DE DADOS DO PERFIL ---
    const loadUserProfile = async () => {
        try {
            const userRef = doc(firestore, "users", userId);
            const docSnap = await getDoc(userRef);
            
            if (docSnap.exists()) {
                userData = docSnap.data();
                userNameEl.textContent = userData.nome || 'Usuário';
                nomeInput.value = userData.nome || '';
                emailInput.value = userData.email || '';
                telefoneInput.value = userData.telefone || '';
                
                if (userData.dataNascimento) {
                    if (userData.dataNascimento.includes('-')) {
                        const [year, month, day] = userData.dataNascimento.split('-');
                        nascimentoInput.value = `${day}/${month}/${year}`;
                    } else {
                        nascimentoInput.value = userData.dataNascimento;
                    }
                } else {
                    nascimentoInput.value = '';
                }
                
                cpfInput.value = userData.cpf || '';
                
                loadOrderHistory();
            } else {
                console.error("Não foi possível encontrar os dados do usuário.");
                orderHistoryList.innerHTML = '<p class="info-message">Erro ao carregar dados do usuário.</p>';
            }
        } catch (error) {
            console.error("Erro ao carregar perfil:", error);
            orderHistoryList.innerHTML = '<p class="info-message">Erro ao carregar perfil. Recarregue a página.</p>';
        }
    };

    // --- LÓGICA DO HISTÓRICO DE PEDIDOS EM TEMPO REAL ---
    const loadOrderHistory = () => {
        orderHistoryList.innerHTML = '<div class="loading-spinner">Carregando pedidos...</div>';
        
        if (!userData) {
            orderHistoryList.innerHTML = '<p class="info-message">Dados do usuário não carregados.</p>';
            return;
        }

        const pedidosRef = collection(firestore, 'pedidos');
        const q = query(pedidosRef, orderBy("data", "desc"));

        onSnapshot(q, 
            (querySnapshot) => {
                handleOrderSnapshot(querySnapshot);
            },
            (error) => {
                console.error("Erro ao carregar histórico:", error);
                orderHistoryList.innerHTML = `
                    <div class="error-container">
                        <p class="error-message">Erro ao carregar histórico de pedidos.</p>
                        <button class="btn-retry" id="retry-button">Tentar Novamente</button>
                    </div>
                `;
                document.getElementById('retry-button').addEventListener('click', () => {
                    loadOrderHistory();
                });
            }
        );
    };

    // --- PROCESSAMENTO DOS PEDIDOS ---
    const handleOrderSnapshot = (querySnapshot) => {
        if (querySnapshot.empty) {
            orderHistoryList.innerHTML = '<p class="info-message">Você ainda não fez nenhum pedido.</p>';
            return;
        }

        let ordersHTML = '';
        let userOrdersCount = 0;
        
        querySnapshot.forEach(doc => {
            try {
                const order = doc.data();
                const orderId = doc.id;
                
                if (!isOrderBelongsToUser(order)) {
                    return;
                }
                
                userOrdersCount++;
                
                let orderDate = 'Data não disponível';
                if (order.data && typeof order.data.toDate === 'function') {
                    orderDate = order.data.toDate().toLocaleDateString('pt-BR');
                }
                
                // =========================================================================
                //  ATUALIZAÇÃO APLICADA AQUI: Lógica para tratar o status "Em preparo"
                // =========================================================================
                let statusText = order.status || 'Pendente';
                let statusForClass = statusText.toLowerCase().replace(' ', '-');

                if (statusText === 'Em preparo') {
                    statusText = 'Pendente'; // Altera o texto de exibição
                    statusForClass = 'pendente'; // Altera a classe CSS para a mesma de "Pendente"
                }
                
                const statusClass = `status-${statusForClass}`;
                // =========================================================================
                //  FIM DA ATUALIZAÇÃO
                // =========================================================================
                
                let itemsHtml = '';
                if (order.itens) {
                    const itensArray = typeof order.itens === 'object' && !Array.isArray(order.itens) 
                        ? Object.values(order.itens) 
                        : order.itens;
                    
                    itensArray.forEach(item => {
                        let customizationsHtml = '';
                        if (item.personalizacoes) {
                            const { removidos, adicionados, observacao } = item.personalizacoes;
                            const details = [];
                            if (removidos && removidos.length > 0) details.push(`<span class="item-customization-detail removed">- Sem ${removidos.join(', ')}</span>`);
                            if (adicionados && adicionados.length > 0) details.push(`<span class="item-customization-detail added">+ ${adicionados.map(a => a.nome).join(', ')}</span>`);
                            if (observacao) details.push(`<span class="item-customization-detail obs">Obs: ${observacao}</span>`);
                            if(details.length > 0) customizationsHtml = `<div class="item-customizations">${details.join('')}</div>`;
                        }
                        itemsHtml += `<li><strong>${item.quantidade}x ${item.nome}</strong>${customizationsHtml}</li>`;
                    });
                }

                ordersHTML += `
                    <div class="order-history-card" data-order-id="${orderId}">
                        <div class="order-summary">
                            <div class="order-info">
                                <strong>Pedido de ${orderDate}</strong>
                                <!-- A variável statusText é usada aqui para exibir o status corrigido -->
                                <span class="order-status ${statusClass}">${statusText}</span>
                            </div>
                            <div class="order-total">
                                R$ ${order.total ? order.total.toFixed(2).replace('.', ',') : '0,00'}
                            </div>
                            <i class="material-icons toggle-details-icon">expand_more</i>
                        </div>
                        <div class="order-details-content">
                            <h4>Itens do Pedido:</h4>
                            <ul>${itemsHtml}</ul>
                            <button class="reorder-btn" data-order-id="${orderId}">
                                <i class="material-icons">replay</i>
                                <span>Pedir Novamente</span>
                            </button>
                        </div>
                    </div>
                `;
            } catch (error) {
                console.error("Erro ao processar pedido:", error, doc.data());
            }
        });

        if (userOrdersCount === 0) {
            orderHistoryList.innerHTML = '<p class="info-message">Você ainda não fez nenhum pedido.</p>';
            return;
        }

        orderHistoryList.innerHTML = ordersHTML;
        addOrderEventListeners();
    };

    // --- VERIFICAR SE O PEDIDO PERTENCE AO USUÁRIO ---
    const isOrderBelongsToUser = (order) => {
        if (order.userId === userId) return true;
        if (order.clienteNome && order.clienteCpf) return order.clienteNome === userData.nome && order.clienteCpf === userData.cpf;
        if (order.cliente && order.cliente.nome && order.cliente.cpf) return order.cliente.nome === userData.nome && order.cliente.cpf === userData.cpf;
        return false;
    };

    // --- EVENT LISTENERS PARA OS PEDIDOS ---
    const addOrderEventListeners = () => {
        const orderCards = orderHistoryList.querySelectorAll('.order-history-card');
        orderCards.forEach(card => {
            const summary = card.querySelector('.order-summary');
            const reorderBtn = card.querySelector('.reorder-btn');

            if (summary) {
                summary.addEventListener('click', () => card.classList.toggle('open'));
            }
            if (reorderBtn) {
                reorderBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    reorderItems(reorderBtn.dataset.orderId);
                });
            }
        });
    };

    // --- REPETIR PEDIDO ---
    const reorderItems = async (orderId) => {
        if (confirm("Seu carrinho atual será substituído por este pedido. Deseja continuar?")) {
            try {
                const orderRef = doc(firestore, "pedidos", orderId);
                const docSnap = await getDoc(orderRef);
                
                if (docSnap.exists()) {
                    const orderData = docSnap.data();
                    if (orderData.itens && Object.keys(orderData.itens).length > 0) {
                        localStorage.setItem('pizzariaCart', JSON.stringify(orderData.itens));
                        alert('Pedido adicionado ao carrinho! Você será redirecionado.');
                        window.location.href = 'carrinho.html';
                    } else {
                        alert('Este pedido não contém itens válidos para serem adicionados ao carrinho.');
                    }
                } else {
                    alert('Pedido não encontrado.');
                }
            } catch(error) {
                console.error("Erro ao refazer o pedido:", error);
                alert("Não foi possível refazer o pedido. Tente novamente.");
            }
        }
    };

    // --- EDIÇÃO DO PERFIL ---
    editBtn.addEventListener('click', () => {
        nomeInput.readOnly = false;
        telefoneInput.readOnly = false;
        nascimentoInput.readOnly = false;
        cpfInput.readOnly = false;
        
        if (nascimentoInput.value.includes('/')) {
            const [day, month, year] = nascimentoInput.value.split('/');
            nascimentoInput.type = 'date';
            nascimentoInput.value = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        } else {
            nascimentoInput.type = 'date';
        }
        
        nomeInput.focus();
        editBtn.style.display = 'none';
        saveBtn.style.display = 'block';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const cpfNumeros = cpfInput.value.replace(/\D/g, '');
        if (cpfNumeros.length !== 11) {
            alert('CPF deve ter 11 dígitos.');
            return;
        }

        if (telefoneInput.value.length > 0 && telefoneInput.value.length < 19) {
            alert('Telefone inválido. Preencha o número completo (+55 XX XXXXX-XXXX) ou deixe o campo em branco.');
            return;
        }

        saveBtn.textContent = 'Salvando...';
        saveBtn.disabled = true;
        
        try {
            const userRef = doc(firestore, "users", userId);
            const updateData = {
                nome: nomeInput.value.trim(),
                telefone: telefoneInput.value,
                dataNascimento: nascimentoInput.value,
                cpf: cpfInput.value
            };
            
            await updateDoc(userRef, updateData);
            
            userData = { ...userData, ...updateData };
            
            const loggedInUser = JSON.parse(sessionStorage.getItem('loggedInUser') || '{}');
            loggedInUser.nome = updateData.nome;
            loggedInUser.cpf = updateData.cpf;
            loggedInUser.telefone = updateData.telefone;
            sessionStorage.setItem('loggedInUser', JSON.stringify(loggedInUser));
            
            alert('Perfil atualizado com sucesso!');
            
            nomeInput.readOnly = true;
            telefoneInput.readOnly = true;
            nascimentoInput.readOnly = true;
            cpfInput.readOnly = true;
            nascimentoInput.type = 'text';
            
            if (nascimentoInput.value) {
                const [year, month, day] = nascimentoInput.value.split('-');
                nascimentoInput.value = `${day}/${month}/${year}`;
            }
            
            editBtn.style.display = 'block';
            saveBtn.style.display = 'none';
            userNameEl.textContent = nomeInput.value.trim();
            
            loadOrderHistory();
            
        } catch(error) {
            console.error("Erro ao salvar perfil:", error);
            alert('Erro ao salvar perfil. Tente novamente.');
        } finally {
            saveBtn.textContent = 'Salvar Alterações';
            saveBtn.disabled = false;
        }
    });

    // --- INICIALIZAÇÃO ---
    loadUserProfile();
});