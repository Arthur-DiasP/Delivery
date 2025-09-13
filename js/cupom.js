// js/cupom.js

import { firestore } from './firebase-config.js';
import { collection, getDocs, doc, getDoc, setDoc, query, where, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    // --- Seletores do DOM ---
    const campaignsListContainer = document.getElementById("campaigns-list");
    const userCouponsSection = document.getElementById("user-coupons-section");
    const userCouponsList = document.getElementById("user-coupons-list");
    const gameOverlay = document.getElementById("game-overlay");
    const gameModal = document.getElementById("game-modal");
    const closeGameBtn = document.getElementById("close-game-btn");
    const gameBoard = document.getElementById("memory-game-board");

    // --- Validação de Sessão ---
    const userId = sessionStorage.getItem("userId");
    if (!userId) {
        alert("Você precisa estar logado para acessar os cupons.");
        window.location.href = "login.html";
        return;
    }

    // --- Estado do Jogo ---
    let activeCampaign = null;
    let chancesLeft = 0;
    let hasFlippedCard = false;
    let lockBoard = false;
    let firstCard, secondCard;
    let matchesFound = 0;

    // --- Imagens para o Jogo ---
    // =========================================================================
    //  ATUALIZAÇÃO APLICADA AQUI: Reduzido para 8 pares (16 cartas)
    // =========================================================================
    const cardImages = [
        'calabresa', 'frango', 'portuguesa', 'mussarela', 
        'quatro-queijos', 'marguerita', 'brocolis', 'palmito'
    ];

    /**
     * Busca e renderiza as campanhas de cupom e os cupons do usuário.
     */
    async function loadCampaignsAndCoupons() {
        campaignsListContainer.innerHTML = '<p>Buscando novas chances para você...</p>';
        userCouponsList.innerHTML = '';
        userCouponsSection.style.display = 'none';

        try {
            // =========================================================================
            //  ALTERAÇÃO PRINCIPAL AQUI: Buscamos TUDO e filtramos no código.
            // =========================================================================

            // 1. Busca TODAS as campanhas da coleção, sem filtros complexos.
            const querySnapshot = await getDocs(collection(firestore, "cupons"));

            // 2. Filtra as campanhas AQUI no código (client-side)
            const activeCampaigns = [];
            const today = new Date().toISOString().split('T')[0];

            querySnapshot.forEach(doc => {
                const campaign = { id: doc.id, ...doc.data() };
                // A lógica de verificação foi movida para cá.
                // A campanha é válida se: for ativa, a data de início já passou E a data de fim ainda não passou.
                if (campaign.ativa === true && campaign.dataInicio <= today && campaign.dataFim >= today) {
                    activeCampaigns.push(campaign);
                }
            });
            // =========================================================================
            // FIM DA ALTERAÇÃO
            // =========================================================================

            if (activeCampaigns.length === 0) {
                campaignsListContainer.innerHTML = '<p>Nenhuma campanha de cupom ativa no momento. Volte em breve!</p>';
                return;
            }

            // 3. Busca os dados de progresso do usuário para cada campanha (lógica inalterada)
            let userProgress = {};
            const userCampaignsRef = collection(firestore, `users/${userId}/cuponsObtidos`);
            const userCampaignsSnapshot = await getDocs(userCampaignsRef);
            userCampaignsSnapshot.forEach(doc => {
                userProgress[doc.id] = doc.data();
            });

            // 4. Renderiza os cards das campanhas e os cupons ganhos (lógica inalterada)
            campaignsListContainer.innerHTML = '';
            activeCampaigns.forEach(campaign => {
                const progress = userProgress[campaign.id] || { tentativasUsadas: 0, codigoGerado: null };
                
                if (progress.codigoGerado) {
                    renderWonCoupon(campaign, progress.codigoGerado);
                } else {
                    renderCampaignCard(campaign, progress);
                }
            });

        } catch (error) {
            console.error("Erro ao carregar campanhas:", error);
            campaignsListContainer.innerHTML = '<p class="error-message">Não foi possível carregar as campanhas.</p>';
        }
    }

    /**
     * Renderiza um card de campanha para o usuário jogar.
     */
    function renderCampaignCard(campaign, progress) {
        const attemptsLeft = campaign.tentativas - progress.tentativasUsadas;
        const canPlay = attemptsLeft > 0;

        const card = document.createElement('div');
        card.className = `scratch-card-wrapper ${!canPlay ? 'claimed' : ''}`;
        card.innerHTML = `
            <div class="scratch-card-header">
                <h3>${campaign.nome}</h3>
                <p>${campaign.descricao}</p>
            </div>
            <button class="btn btn-primary" ${!canPlay ? 'disabled' : ''}>
                ${canPlay ? `Jogar (${attemptsLeft} tentativa${attemptsLeft > 1 ? 's' : ''})` : 'Tentativas Esgotadas'}
            </button>
        `;

        if (canPlay) {
            card.querySelector('button').addEventListener('click', () => {
                activeCampaign = campaign;
                chancesLeft = campaign.chances;
                const attemptsLeftNow = campaign.tentativas - (progress.tentativasUsadas || 0);
                startGame(attemptsLeftNow);
            });
        }
        campaignsListContainer.appendChild(card);
    }

    /**
     * Renderiza um cupom que o usuário já ganhou.
     */
    function renderWonCoupon(campaign, code) {
        userCouponsSection.style.display = 'block';
        const couponItem = document.createElement('div');
        couponItem.className = 'coupon-item';
        couponItem.innerHTML = `
            <div>
                <span class="coupon-code">${code}</span>
                <small>${campaign.nome}</small>
            </div>
            <span class="coupon-discount">${campaign.desconto}% OFF</span>
        `;
        userCouponsList.appendChild(couponItem);
    }
    
    /**
     * Inicia o jogo da memória.
     */
    function startGame(attemptsLeft) {
        resetBoard();
        matchesFound = 0;
        document.getElementById("game-title").textContent = activeCampaign.nome;
        document.getElementById("game-description").textContent = activeCampaign.descricao;
        document.getElementById("game-chances-left").textContent = chancesLeft;
        document.getElementById("game-attempts-left").textContent = `${attemptsLeft} / ${activeCampaign.tentativas}`;
        
        const gameCards = [...cardImages, ...cardImages]; // 8 pares = 16 cartas
        shuffle(gameCards);

        gameBoard.innerHTML = ''; // Limpa o tabuleiro anterior
        gameCards.forEach(imageName => {
            const cardElement = document.createElement('div');
            cardElement.classList.add('memory-card');
            cardElement.dataset.framework = imageName;
            cardElement.innerHTML = `
                <img class="card-front" src="img/game/${imageName}.png" alt="Pizza">
                <div class="card-back"></div>
            `;
            cardElement.addEventListener('click', flipCard);
            gameBoard.appendChild(cardElement);
        });

        document.getElementById("game-start-screen").style.display = 'block';
        document.getElementById("game-result-screen").style.display = 'none';
        gameOverlay.classList.add("visible");
    }

    function shuffle(array) {
        array.sort(() => Math.random() - 0.5);
    }

    function flipCard() {
        if (lockBoard) return;
        if (this === firstCard) return;

        this.classList.add('is-flipped');

        if (!hasFlippedCard) {
            hasFlippedCard = true;
            firstCard = this;
            return;
        }

        secondCard = this;
        lockBoard = true;
        
        chancesLeft--;
        document.getElementById("game-chances-left").textContent = chancesLeft;

        checkForMatch();
    }
    
    function checkForMatch() {
        const isMatch = firstCard.dataset.framework === secondCard.dataset.framework;
        isMatch ? disableCards() : unflipCards();

        setTimeout(() => {
             if (matchesFound === cardImages.length) {
                endGame(true); // Vitória
            } else if (chancesLeft <= 0) {
                endGame(false); // Derrota
            }
        }, 800);
    }

    function disableCards() {
        firstCard.removeEventListener('click', flipCard);
        secondCard.removeEventListener('click', flipCard);
        firstCard.classList.add('matched');
        secondCard.classList.add('matched');
        matchesFound++;
        resetBoard();
    }
    
    function unflipCards() {
        setTimeout(() => {
            firstCard.classList.add('shake');
            secondCard.classList.add('shake');
        }, 400);

        setTimeout(() => {
            firstCard.classList.remove('is-flipped', 'shake');
            secondCard.classList.remove('is-flipped', 'shake');
            resetBoard();
        }, 1200);
    }
    
    function resetBoard() {
        [hasFlippedCard, lockBoard] = [false, false];
        [firstCard, secondCard] = [null, null];
    }
    
    /**
     * Finaliza o jogo, mostrando o resultado e atualizando o Firestore.
     */
    async function endGame(isWin) {
        lockBoard = true;
        const userProgressRef = doc(firestore, `users/${userId}/cuponsObtidos`, activeCampaign.id);

        let newProgress;
        
        if (isWin) {
            const couponCode = `JOGO${activeCampaign.desconto}${generateRandomCode(4)}`;
            newProgress = {
                tentativasUsadas: (await getDoc(userProgressRef)).data()?.tentativasUsadas + 1 || 1,
                codigoGerado: couponCode,
                dataObtencao: Timestamp.now()
            };
            showResultScreen(true, couponCode);
        } else {
             newProgress = {
                tentativasUsadas: (await getDoc(userProgressRef)).data()?.tentativasUsadas + 1 || 1,
                codigoGerado: null
            };
            showResultScreen(false);
        }

        try {
            await setDoc(userProgressRef, newProgress, { merge: true });
        } catch (error) {
            console.error("Erro ao salvar progresso do jogo:", error);
        }
    }
    
    function showResultScreen(isWin, couponCode = '') {
        document.getElementById("game-start-screen").style.display = 'none';
        
        const resultTitle = document.getElementById("result-title");
        const resultMessage = document.getElementById("result-message");
        const couponArea = document.getElementById("modal-coupon-area");
        const modalButton = document.getElementById("modal-button");

        if (isWin) {
            resultTitle.textContent = "Parabéns!";
            resultMessage.textContent = `Você encontrou todos os pares e ganhou um cupom de ${activeCampaign.desconto}% de desconto!`;
            couponArea.style.display = 'block';
            document.getElementById("result-coupon-code").textContent = couponCode;
            modalButton.textContent = "Usar depois";
        } else {
            resultTitle.textContent = "Quase lá!";
            resultMessage.textContent = "Suas chances acabaram, mas não desista! Tente novamente em outra oportunidade.";
            couponArea.style.display = 'none';
            modalButton.textContent = "Entendi";
        }
        
        document.getElementById("game-result-screen").style.display = 'block';
    }

    function generateRandomCode(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    
    closeGameBtn.addEventListener('click', () => {
        gameOverlay.classList.remove('visible');
        loadCampaignsAndCoupons();
    });
    
    document.getElementById('modal-button').addEventListener('click', () => {
         gameOverlay.classList.remove('visible');
         loadCampaignsAndCoupons();
    });

    // --- Ponto de Partida ---
    loadCampaignsAndCoupons();
});