document.addEventListener('DOMContentLoaded', () => {
    const satisfactionOptions = document.querySelector('.satisfaction-options');
    const cards = document.querySelectorAll('.satisfaction-card');
    const feedbackToast = document.getElementById('feedback-toast');
    const centerMessage = document.getElementById('center-message');

    const FEEDBACK_DURATION = 1000; // 1 segundo
    const REENABLE_DELAY = 200; // tempo para finalizar animações

    cards.forEach(card => {
        card.addEventListener('click', () => {
            // Previne múltiplos cliques se a área já estiver desativada
            if (satisfactionOptions.classList.contains('disabled')) return;

            // Desativa todos os cards
            satisfactionOptions.classList.add('disabled');
            
            // Destaca o card clicado
            card.classList.add('clicked');

            const satisfaction = card.id;
            registerSatisfaction(satisfaction);

            // Mostra as mensagens de feedback (toast e centro)
            feedbackToast.classList.add('show');
            if (centerMessage) {
                centerMessage.classList.remove('hidden');
                centerMessage.classList.add('show');
            }

            // Após 1 segundo, esconde e reativa cliques
            setTimeout(() => {
                feedbackToast.classList.remove('show');
                if (centerMessage) {
                    centerMessage.classList.remove('show');
                }

                setTimeout(() => {
                    satisfactionOptions.classList.remove('disabled');
                    card.classList.remove('clicked');
                    if (centerMessage) centerMessage.classList.add('hidden');
                }, REENABLE_DELAY);
            }, FEEDBACK_DURATION);
        });
    });

    async function registerSatisfaction(satisfaction) {
        const now = new Date();
        const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        const dateStr = now.toLocaleDateString('pt-PT');
        const timeStr = now.toLocaleTimeString('pt-PT');
        const weekDay = days[now.getDay()];

        const counterRef = db.collection('metadata').doc('counters');

        try {
            await db.runTransaction(async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                let newId = 1;

                if (counterDoc.exists) {
                    const data = counterDoc.data();
                    if (data.current_satisfaction_id) {
                        newId = data.current_satisfaction_id + 1;
                    }
                }

                const newLogRef = db.collection('satisfaction_logs').doc();

                transaction.set(counterRef, { current_satisfaction_id: newId }, { merge: true });
                transaction.set(newLogRef, {
                    id: newId,
                    satisfacao: satisfaction,
                    data: dateStr,
                    hora: timeStr,
                    diaSemana: weekDay
                });
            });
            console.log("Registo enviado com ID sequencial.");
        } catch (error) {
            console.error("Erro ao adicionar registo: ", error);
        }
    }

    // --- Lógica do Link de Admin ---
    const adminLink = document.getElementById('admin-link');
    adminLink.addEventListener('click', function(event) {
        event.preventDefault();
        window.location.href = 'admin_login.html';
    });
});
