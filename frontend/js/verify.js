// verify.js - Vérification d'une attestation

document.addEventListener('DOMContentLoaded', () => {
    // URL du backend sur Render
    const API_URL = 'https://diplomachain.onrender.com/api';
    const verifyBtn = document.getElementById('verifyBtn');
    const resultDiv = document.getElementById('result');

    if (verifyBtn) {
        verifyBtn.addEventListener('click', async () => {
            const matricule = document.getElementById('matricule').value.trim();
            const typeAttestation = document.getElementById('typeAttestation').value;

            if (!matricule) {
                resultDiv.innerHTML = '<div style="background: #f8d7da; color: #721c24; padding: 10px;">❌ Entrez un matricule</div>';
                return;
            }

            resultDiv.innerHTML = '<div class="loading">🔍 Vérification en cours...</div>';

            try {
                // ✅ Utiliser API_URL au lieu de localhost
                const response = await fetch(`${API_URL}/attestation/${matricule}/${typeAttestation}`);
                const data = await response.json();

                if (!data.success) {
                    resultDiv.innerHTML = `<div style="background: #f8d7da; color: #721c24; padding: 10px;">❌ ${data.error}</div>`;
                    return;
                }

                const d = data.data;
                const status = d[9] === 1 ? '✅ ACTIF' : '❌ RÉVOQUÉ';
                const date = new Date(d[5] * 1000).toLocaleDateString();

                resultDiv.innerHTML = `
                    <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <strong>${d[0]} ${d[1]}</strong>
                            <span style="background: ${d[9] === 1 ? '#10b981' : '#ef4444'}; color: white; padding: 4px 8px; border-radius: 20px;">${status}</span>
                        </div>
                        <p><strong>Matricule:</strong> ${d[3]}</p>
                        <p><strong>Filière:</strong> ${d[4]}</p>
                        <p><strong>Type:</strong> ${d[2]}</p>
                        <p><strong>Date:</strong> ${date}</p>
                        <p><strong>Mention:</strong> ${d[6]}</p>
                        <div style="margin-top: 10px;">
                            <a href="https://arweave.net/${d[7]}" target="_blank">📄 PDF</a> | 
                            <a href="https://arweave.net/${d[8]}" target="_blank">🖼️ Photo</a>
                        </div>
                    </div>
                `;

            } catch (error) {
                resultDiv.innerHTML = `<div style="background: #f8d7da; color: #721c24; padding: 10px;">❌ Erreur: ${error.message}</div>`;
            }
        });
    }
});