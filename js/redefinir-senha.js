// js/redefinir-senha.js

import { firestore } from './firebase-config.js';
import { collection, getDocs, query, where, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const mainTitle = document.getElementById('main-title');
    const formSubtitle = document.getElementById('form-subtitle');
    const requestIdentifierForm = document.getElementById('requestIdentifierForm');
    const verifyDetailsForm = document.getElementById('verifyDetailsForm');
    const updatePasswordForm = document.getElementById('updatePasswordForm');
    const finalSuccessMessage = document.getElementById('final-success-message');
    const identifierInput = document.getElementById('identifier');

    let resetState = {
        userId: null,
        userData: null
    };

    const showError = (formId, message) => {
        const errorElement = document.getElementById(`${formId}-error-message`);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    };

    // =========================================================================
    //  INÍCIO DA ATUALIZAÇÃO: Adiciona a mesma máscara de telefone aqui
    // =========================================================================
    identifierInput.addEventListener('input', (e) => {
        const value = e.target.value;
        if (!value.includes('@')) { // Aplica a máscara apenas se não for um e-mail
            let digits = value.replace(/\D/g, '');
            digits = digits.slice(0, 13);
            digits = digits.replace(/^(\d{2})/, '+$1 ');
            digits = digits.replace(/\+(\d{2})\s(\d{2})/, '+$1 ($2) ');
            digits = digits.replace(/(\d{5})(\d)/, '$1-$2');
            e.target.value = digits;
        }
    });
    // =========================================================================
    //  FIM DA ATUALIZAÇÃO
    // =========================================================================

    requestIdentifierForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = requestIdentifierForm.querySelector('button[type="submit"]');
        const identifier = identifierInput.value.trim();
        document.getElementById('request-error-message').style.display = 'none';

        if (!identifier) {
            showError('request', 'Por favor, insira seu e-mail ou telefone.');
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Verificando...';

        try {
            const usersRef = collection(firestore, 'users');
            let q;

            if (identifier.includes('@')) {
                q = query(usersRef, where("email", "==", identifier));
            } else {
                q = query(usersRef, where("telefone", "==", identifier));
            }

            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                showError('request', 'Nenhuma conta encontrada com este identificador.');
                return;
            }

            const userDoc = querySnapshot.docs[0];
            resetState = {
                userId: userDoc.id,
                userData: userDoc.data()
            };

            requestIdentifierForm.style.display = 'none';
            formSubtitle.textContent = 'Para sua segurança, confirme seus dados.';
            verifyDetailsForm.style.display = 'block';

        } catch (error) {
            console.error("Erro na Etapa 1:", error);
            showError('request', 'Ocorreu um erro no servidor. Tente novamente.');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Verificar';
        }
    });

    verifyDetailsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fullNameInput = document.getElementById('fullName');
        const birthDateInput = document.getElementById('birthDate');
        document.getElementById('verify-error-message').style.display = 'none';

        const enteredName = fullNameInput.value.trim().toLowerCase();
        const enteredDob = birthDateInput.value;

        const storedName = resetState.userData.nome.trim().toLowerCase();
        const storedDob = resetState.userData.dataNascimento;

        if (enteredName === storedName && enteredDob === storedDob) {
            verifyDetailsForm.style.display = 'none';
            formSubtitle.textContent = 'Agora, crie sua nova senha.';
            updatePasswordForm.style.display = 'block';
        } else {
            showError('verify', 'Os dados não conferem com nosso registro. Tente novamente.');
        }
    });

    updatePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPasswordInput = document.getElementById('new-password');
        const confirmPasswordInput = document.getElementById('confirm-password');
        const submitButton = updatePasswordForm.querySelector('button[type="submit"]');
        document.getElementById('update-error-message').style.display = 'none';

        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (!/^\d{6}$/.test(newPassword)) {
            showError('update', 'A nova senha deve ter exatamente 6 dígitos numéricos.');
            return;
        }
        if (newPassword !== confirmPassword) {
            showError('update', 'As senhas não coincidem.');
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Atualizando...';

        try {
            const userRef = doc(firestore, 'users', resetState.userId);
            await updateDoc(userRef, {
                senha: newPassword
            });

            mainTitle.textContent = "Sucesso!";
            formSubtitle.style.display = 'none';
            updatePasswordForm.style.display = 'none';
            finalSuccessMessage.textContent = 'Sua senha foi redefinida com sucesso! Você já pode fazer login com a nova senha.';
            finalSuccessMessage.style.display = 'block';

        } catch (error) {
            console.error("Erro ao atualizar senha:", error);
            showError('update', 'Não foi possível atualizar sua senha. Tente novamente.');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Redefinir Senha';
        }
    });
});