// admin.js - Gestion de l'administration (ajout + révocation)

document.addEventListener('DOMContentLoaded', async () => {

    // ============================================
    // RÉCUPÉRATION DE L'ADRESSE DU CONTRAT
    // ============================================
    const API_URL = 'https://diplomachain.onrender.com/api';
    let contractAddress = null;
    
    try {
        // ✅ Utiliser API_URL au lieu de localhost
        const response = await fetch(`${API_URL}/contract-address`);
        const data = await response.json();
        contractAddress = data.address;
        console.log("✅ Adresse du contrat:", contractAddress);
    } catch (error) {
        console.error("❌ Erreur récupération adresse:", error);
        contractAddress = "0xc266a86428314da3494395EA422AD32ec9508BCb";
    }

    // ============================================
    // FONCTION QR CODE (Google Charts)
    // ============================================
    function generateQRCode(text, elementId) {
        const container = document.getElementById(elementId);
        if (!container) return;
        container.innerHTML = '';
        
        const qrUrl = `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(text)}`;
        const img = document.createElement('img');
        img.src = qrUrl;
        img.width = 200;
        img.height = 200;
        img.alt = "QR Code";
        
        container.appendChild(img);
    }

    // ============================================
    // AJOUT D'ATTESTATION
    // ============================================
    const form = document.getElementById('attestationForm');
    const resultDiv = document.getElementById('result');
    const submitBtn = form?.querySelector('button[type="submit"]');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = "⏳ Envoi en cours...";

            try {
                const attestationData = {
                    nom: document.getElementById('nom').value.toUpperCase(),
                    prenom: document.getElementById('prenom').value,
                    typeAttestation: document.getElementById('typeAttestation').value,
                    matricule: document.getElementById('matricule').value,
                    filiere: document.getElementById('filiere').value,
                    dateObtention: Math.floor(new Date(document.getElementById('dateObtention').value).getTime() / 1000),
                    mention: document.getElementById('mention').value
                };

                const pdfFile = document.getElementById('pdfFile').files[0];
                const photoFile = document.getElementById('photoFile').files[0];

                if (!pdfFile || !photoFile) {
                    alert("Veuillez sélectionner un PDF et une photo");
                    return;
                }

                const pdfId = await window.uploadToArweave(pdfFile, 'application/pdf');
                const photoId = await window.uploadToArweave(photoFile, photoFile.type);

                // ✅ Utiliser API_URL
                const response = await fetch(`${API_URL}/prepare-signature`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ attestationData, pdfId, photoId })
                });

                const { domain, types, message } = await response.json();

                const provider = new ethers.providers.Web3Provider(window.ethereum);
                const signer = provider.getSigner();
                const signature = await signer._signTypedData(domain, types, message);

                const contractABI = [
                    "function ajouter(string nom, string prenom, string typeAttestation, string matricule, string filiere, uint256 dateObtention, string mention, string hashAttestation, string hashPhoto, bytes signature) external returns (bytes32)"
                ];

                const contract = new ethers.Contract(contractAddress, contractABI, signer);

                const tx = await contract.ajouter(
                    message.nom, message.prenom, message.typeAttestation,
                    message.matricule, message.filiere, message.dateObtention,
                    message.mention, message.hashAttestation, message.hashPhoto,
                    signature,
                    { 
                        gasLimit: 5000000,
                        gasPrice: ethers.utils.parseUnits("35", "gwei")
                    }
                );

                const receipt = await tx.wait();

                // Générer le QR code
                const baseUrl = `${window.location.protocol}//${window.location.host}`;
                const verificationUrl = `${baseUrl}/verify.html?matricule=${attestationData.matricule}&type=${attestationData.typeAttestation}`;
                generateQRCode(verificationUrl, 'qrcode');
                
                // Afficher le conteneur QR code
                const qrContainer = document.getElementById('qrCodeContainer');
                if (qrContainer) {
                    qrContainer.style.display = 'block';
                }
                
                const qrLink = document.getElementById('qrLink');
                if (qrLink) {
                    qrLink.innerHTML = `<a href="${verificationUrl}" target="_blank">${verificationUrl}</a>`;
                }

                resultDiv.innerHTML = `
                    <div style="background: #d4edda; color: #155724; padding: 15px; border-radius: 8px;">
                        ✅ Attestation ajoutée !<br>
                        Transaction: ${receipt.transactionHash.slice(0, 30)}...
                    </div>
                `;

                form.reset();

            } catch (error) {
                console.error(error);
                resultDiv.innerHTML = `<div style="background: #f8d7da; color: #721c24; padding: 10px;">❌ Erreur: ${error.message}</div>`;
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }

    // ============================================
    // RÉVOCATION
    // ============================================
    const revokeBtn = document.getElementById('revokeBtn');
    if (revokeBtn) {
        revokeBtn.addEventListener('click', async () => {
            const matricule = document.getElementById('revokeMatricule').value.trim();
            const typeAttestation = document.getElementById('revokeType').value;
            const resultDiv = document.getElementById('revokeResult');
            
            if (!matricule) {
                resultDiv.innerHTML = '<div style="background: #f8d7da; color: #721c24; padding: 10px;">❌ Entrez un matricule</div>';
                return;
            }
            
            resultDiv.innerHTML = '<div class="loading">⏳ Révocation en cours...</div>';
            
            try {
                const provider = new ethers.providers.Web3Provider(window.ethereum);
                const signer = provider.getSigner();
                const signerAddress = await signer.getAddress();
                
                const contractCheck = new ethers.Contract(
                    contractAddress,
                    [
                        "function REVOKER_ROLE() view returns (bytes32)",
                        "function hasRole(bytes32 role, address account) view returns (bool)"
                    ],
                    provider
                );
                
                const REVOKER_ROLE = await contractCheck.REVOKER_ROLE();
                const hasRole = await contractCheck.hasRole(REVOKER_ROLE, signerAddress);
                
                if (!hasRole) {
                    resultDiv.innerHTML = '<div style="background: #f8d7da; color: #721c24; padding: 10px;">❌ Vous n\'avez pas le droit de révoquer</div>';
                    return;
                }
                
                const contractWithSigner = new ethers.Contract(
                    contractAddress,
                    ["function revoquerParMatriculeEtType(string,string) external"],
                    signer
                );
                
                const tx = await contractWithSigner.revoquerParMatriculeEtType(
                    matricule, 
                    typeAttestation,
                    { 
                        gasLimit: 3000000,
                        gasPrice: ethers.utils.parseUnits("35", "gwei")
                    }
                );
                
                const receipt = await tx.wait();
                
                resultDiv.innerHTML = `
                    <div style="background: #d4edda; color: #155724; padding: 15px;">
                        ✅ Attestation révoquée !<br>
                        Transaction: ${receipt.transactionHash.slice(0, 30)}...
                    </div>
                `;
                document.getElementById('revokeMatricule').value = '';
                
            } catch (error) {
                console.error(error);
                resultDiv.innerHTML = `<div style="background: #f8d7da; color: #721c24; padding: 10px;">❌ Erreur: ${error.message}</div>`;
            }
        });
    }
});