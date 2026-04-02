// list.js - Liste des attestations (version premium)

document.addEventListener('DOMContentLoaded', () => {
    // URL du backend sur Render
    const API_URL = 'https://diplomachain.onrender.com/api';
    const container = document.getElementById('listContainer');
    const loadBtn = document.getElementById('loadBtn');
    const filterInput = document.getElementById('filterInput');

    let allDiplomes = [];

    function showLoader() {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="display: inline-block; width: 50px; height: 50px; border: 3px solid #e2e8f0; border-top-color: #2c3e50; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                <p style="margin-top: 20px; color: #4a5568;">Chargement des attestations...</p>
            </div>
        `;
    }

    function renderDiplomes(diplomes) {
        if (diplomes.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <div style="font-size: 4em; margin-bottom: 20px;">📭</div>
                    <h3 style="color: #4a5568;">Aucune attestation</h3>
                    <p style="color: #718096;">Aucune attestation n'a encore été enregistrée.</p>
                </div>
            `;
            return;
        }

        let html = '<div style="display: flex; flex-direction: column; gap: 16px;">';
        
        for (let i = 0; i < diplomes.length; i++) {
            const d = diplomes[i];
            const status = d[9] === 1 ? 'ACTIF' : 'RÉVOQUÉ';
            const isActive = d[9] === 1;
            const timestamp = d[5]?.hex ? parseInt(d[5].hex, 16) : d[5];
            const date = new Date(timestamp * 1000).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            
            const initials = `${d[0].charAt(0)}${d[1].charAt(0)}`;
            
            html += `
                <div style="
                    background: white;
                    border-radius: 20px;
                    padding: 20px;
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
                    border: 1px solid #edf2f7;
                    cursor: pointer;
                " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 12px 24px rgba(0,0,0,0.1)';" 
                   onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.04)';">
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="
                                width: 48px;
                                height: 48px;
                                background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
                                border-radius: 50%;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                font-weight: bold;
                                font-size: 1.2em;
                                color: white;
                            ">${initials}</div>
                            <div>
                                <h3 style="margin: 0; font-size: 1.2em; color: #2d3748;">${d[0]} ${d[1]}</h3>
                                <p style="margin: 4px 0 0; font-size: 0.85em; color: #718096;">Matricule: ${d[3]}</p>
                            </div>
                        </div>
                        <span style="
                            padding: 6px 14px;
                            border-radius: 50px;
                            font-size: 0.75em;
                            font-weight: 600;
                            background: ${isActive ? '#e6f7e6' : '#ffe6e6'};
                            color: ${isActive ? '#2e7d32' : '#c62828'};
                        ">
                            ${isActive ? '● ACTIF' : '○ RÉVOQUÉ'}
                        </span>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin: 16px 0; padding-top: 12px; border-top: 1px solid #edf2f7;">
                        <div>
                            <span style="font-size: 0.7em; text-transform: uppercase; letter-spacing: 0.5px; color: #a0aec0;">Type</span>
                            <p style="margin: 4px 0 0; font-weight: 500; color: #2d3748;">${d[2]}</p>
                        </div>
                        <div>
                            <span style="font-size: 0.7em; text-transform: uppercase; letter-spacing: 0.5px; color: #a0aec0;">Filière</span>
                            <p style="margin: 4px 0 0; font-weight: 500; color: #2d3748;">${d[4]}</p>
                        </div>
                        <div>
                            <span style="font-size: 0.7em; text-transform: uppercase; letter-spacing: 0.5px; color: #a0aec0;">Mention</span>
                            <p style="margin: 4px 0 0; font-weight: 500; color: #2d3748;">${d[6]}</p>
                        </div>
                        <div>
                            <span style="font-size: 0.7em; text-transform: uppercase; letter-spacing: 0.5px; color: #a0aec0;">Date</span>
                            <p style="margin: 4px 0 0; font-weight: 500; color: #2d3748;">${date}</p>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 16px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #edf2f7;">
                        <a href="https://arweave.net/${d[7]}" target="_blank" style="
                            display: inline-flex;
                            align-items: center;
                            gap: 6px;
                            color: #4a5568;
                            text-decoration: none;
                            font-size: 0.85em;
                            transition: color 0.2s;
                            padding: 4px 8px;
                            border-radius: 8px;
                            background: #f7fafc;
                        " onmouseover="this.style.color='#2c3e50'; this.style.background='#edf2f7';" onmouseout="this.style.color='#4a5568'; this.style.background='#f7fafc';">
                            📄 PDF
                        </a>
                        <a href="https://arweave.net/${d[8]}" target="_blank" style="
                            display: inline-flex;
                            align-items: center;
                            gap: 6px;
                            color: #4a5568;
                            text-decoration: none;
                            font-size: 0.85em;
                            transition: color 0.2s;
                            padding: 4px 8px;
                            border-radius: 8px;
                            background: #f7fafc;
                        " onmouseover="this.style.color='#2c3e50'; this.style.background='#edf2f7';" onmouseout="this.style.color='#4a5568'; this.style.background='#f7fafc';">
                            🖼️ Photo
                        </a>
                    </div>
                </div>
            `;
        }
        html += '</div>';
        container.innerHTML = html;
    }

    function filterDiplomes(searchTerm) {
        if (!allDiplomes.length) return;
        
        const term = searchTerm.toLowerCase().trim();
        if (!term) {
            renderDiplomes(allDiplomes);
            return;
        }
        
        const filtered = allDiplomes.filter(d => {
            const nom = d[0]?.toLowerCase() || '';
            const prenom = d[1]?.toLowerCase() || '';
            const matricule = d[3]?.toLowerCase() || '';
            const filiere = d[4]?.toLowerCase() || '';
            const type = d[2]?.toLowerCase() || '';
            return nom.includes(term) || prenom.includes(term) || matricule.includes(term) || filiere.includes(term) || type.includes(term);
        });
        
        renderDiplomes(filtered);
        
        const filterInfo = document.getElementById('filterInfo');
        if (filterInfo) {
            filterInfo.innerHTML = filtered.length === allDiplomes.length 
                ? `${filtered.length} attestation${filtered.length > 1 ? 's' : ''}`
                : `${filtered.length} résultat${filtered.length > 1 ? 's' : ''} sur ${allDiplomes.length}`;
        }
    }

    async function loadDiplomes() {
        showLoader();

        try {
            // ✅ Utiliser API_URL au lieu de localhost
            const response = await fetch(`${API_URL}/diplomes?page=0&limit=100`);
            const diplomes = await response.json();
            allDiplomes = diplomes;
            
            renderDiplomes(allDiplomes);
            
            const filterInfo = document.getElementById('filterInfo');
            if (filterInfo) {
                filterInfo.innerHTML = `${allDiplomes.length} attestation${allDiplomes.length > 1 ? 's' : ''}`;
            }
            
            console.log(`✅ ${allDiplomes.length} attestations chargées`);
            
        } catch (error) {
            console.error(error);
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <div style="font-size: 3em; margin-bottom: 20px;">⚠️</div>
                    <h3 style="color: #c62828;">Erreur de chargement</h3>
                    <p style="color: #718096;">${error.message}</p>
                    <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 24px; background: #2c3e50; color: white; border: none; border-radius: 8px; cursor: pointer;">🔄 Réessayer</button>
                </div>
            `;
        }
    }

    if (loadBtn) {
        loadBtn.addEventListener('click', loadDiplomes);
    }
    
    if (filterInput) {
        filterInput.addEventListener('input', (e) => filterDiplomes(e.target.value));
    }
    
    loadDiplomes();
});