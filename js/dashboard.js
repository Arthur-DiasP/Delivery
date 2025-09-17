// js/dashboard.js - O Controlador Principal
import { firestore } from './firebase-config.js';
import { collection, onSnapshot, query, where, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    
    // ===============================================
    // LÓGICA DE NAVEGAÇÃO E CARREGAMENTO DE MÓDULOS
    // ===============================================
    const sidebar = document.querySelector('.sidebar');
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const sidebarLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    const contentSections = document.querySelectorAll('.content-section');
    const mainContentTitle = document.getElementById('main-content-title');

    const loadedModules = new Set();

    const loadModuleFor = async (sectionId) => {
        if (loadedModules.has(sectionId)) return;
        try {
            let module;
            switch (sectionId) {
                case 'inicio': module = await import('./dashboard-inicio.js'); break;
                case 'cardapio': module = await import('./dashboard-cardapio.js'); break;
                case 'personalizacoes': module = await import('./dashboard-personalizacoes.js'); break;
                case 'anuncios': module = await import('./dashboard-anuncios.js'); break;
                case 'cupom': module = await import('./dashboard-cupom.js'); break;
                // =========================================================================
                //  INÍCIO DA ATUALIZAÇÃO: Carregando os dois módulos de cupom
                // =========================================================================
                case 'cupons-promocionais': 
                    module = await import('./dashboard-cupom.js'); 
                    // Chama a função específica para os cupons promocionais
                    if (module && typeof module.initPromocionais === 'function') {
                        await module.initPromocionais();
                        loadedModules.add(sectionId);
                    }
                    return; // Retorna para evitar a chamada do `module.init()` padrão
                // =========================================================================
                //  FIM DA ATUALIZAÇÃO
                // =========================================================================
                case 'ofertas': module = await import('./dashboard-ofertas.js'); break;
                case 'entrega': module = await import('./dashboard-entrega.js'); break;
                case 'calendario': module = await import('./dashboard-calendario.js'); break;
                case 'pedidos': module = await import('./dashboard-pedidos.js'); break;
                case 'motoboy': module = await import('./dashboard-motoboy.js'); break;
                default: console.warn(`Nenhum módulo para a seção: ${sectionId}`); return;
            }
            // A chamada padrão para 'init' continua funcionando para as outras seções
            if (module && typeof module.init === 'function') {
                await module.init(); 
                loadedModules.add(sectionId);
            }
        } catch (error) {
            console.error(`Falha ao carregar o módulo para a seção '${sectionId}':`, error);
        }
    };

    const switchSection = (targetId) => {
        contentSections.forEach(section => section.classList.remove('active'));
        sidebarLinks.forEach(link => link.classList.remove('active'));
        
        const targetSection = document.getElementById(`section-${targetId}`);
        if(targetSection) targetSection.classList.add('active');
        
        const activeLink = document.querySelector(`.nav-link[data-target="${targetId}"]`);
        if(activeLink) {
            activeLink.classList.add('active');
            mainContentTitle.textContent = activeLink.querySelector('span').textContent;
        }

        loadModuleFor(targetId);

        if (window.innerWidth <= 768 && sidebar.classList.contains('sidebar-open')) {
            sidebar.classList.remove('sidebar-open');
            mobileMenuToggle.querySelector('i').textContent = 'menu';
        }
    };

    mobileMenuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('sidebar-open');
        const icon = mobileMenuToggle.querySelector('i');
        icon.textContent = sidebar.classList.contains('sidebar-open') ? 'close' : 'menu';
    });

    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.getAttribute('data-target');
            if (!link.classList.contains('active')) {
                switchSection(target);
            }
        });
    });

    // ================================================================
    // SISTEMA DE NOTIFICAÇÃO DE PEDIDOS EM TEMPO REAL (PERSISTENTE)
    // ================================================================
    function initializeRealtimeOrderNotifier() {
        const notificationBar = document.getElementById('persistent-notification-bar');
        const notificationMessage = document.getElementById('notification-message');
        const viewOrderBtn = document.getElementById('view-order-btn');
        const notificationCloseBtn = document.getElementById('notification-close-btn');
        const soundElement = document.getElementById('notification-sound');

        const hideNotification = () => {
            notificationBar.classList.remove('visible');
        };
        
        notificationCloseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            hideNotification();
        });

        viewOrderBtn.addEventListener('click', () => {
            hideNotification();
            switchSection('pedidos');
        });
        
        const startTime = Timestamp.now();
        const q = query(collection(firestore, "pedidos"), where("data", ">", startTime));

        onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const pedido = change.doc.data();
                    const nomeCliente = pedido.cliente?.nome || "Novo Cliente";

                    notificationMessage.textContent = `Pedido de ${nomeCliente} acaba de chegar!`;
                    notificationBar.classList.add('visible');

                    soundElement.play().catch(error => {
                        console.warn("A reprodução automática de som foi bloqueada pelo navegador.", error);
                    });

                    const cardPedidosHoje = document.getElementById('card-pedidos-hoje');
                    if (cardPedidosHoje) {
                        cardPedidosHoje.classList.remove('new-order-pulse');
                        void cardPedidosHoje.offsetWidth;
                        cardPedidosHoje.classList.add('new-order-pulse');
                    }
                }
            });
        });
    }

    // ===============================================
    // INICIALIZAÇÃO DA PÁGINA
    // ===============================================
    switchSection('inicio');
    initializeRealtimeOrderNotifier();
});