document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('.satisfaction-buttons button');
    const feedbackMessage = document.getElementById('feedback-message');
    let blockClicks = false;

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            if (blockClicks) return;

            blockClicks = true;
            const satisfaction = button.id;
            
            registerSatisfaction(satisfaction);

            feedbackMessage.classList.remove('hidden');

            setTimeout(() => {
                feedbackMessage.classList.add('hidden');
                blockClicks = false;
            }, 3000); // Bloqueia por 3 segundos
        });
    });

    function registerSatisfaction(satisfaction) {
        const now = new Date();
        const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

        db.collection('satisfaction_logs').add({
            satisfacao: satisfaction,
            data: now.toLocaleDateString('pt-PT'),
            hora: now.toLocaleTimeString('pt-PT'),
            diaSemana: days[now.getDay()]
        })
        .then((docRef) => {
            console.log("Document written with ID: ", docRef.id);
        })
        .catch((error) => {
            console.error("Error adding document: ", error);
        });
    }
});
