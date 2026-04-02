const { ethers } = require("ethers");
const contractABI = require("../contrat/AttestationABI.json");
require("dotenv").config();

const provider =  new ethers.providers.JsonRpcProvider(process.env.POLYGON_RPC);


const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS,contractABI, provider);


async function getNomUniversite() 
{
	const nom = await contract.universiteNom();
	console.log("Nom de l'universite : ", nom);
	return nom;
}

async function listDiplome(page = 0, limit = 10) 
{
	const diplomes = await contract.listerDiplomes(page, limit);
	console.log("page ${page} : ${diplomes.length}" , diplomes);
	return diplomes;
}

async function getAttestation(matricule, typeAttestation) 
{
	try
	{
		const diplome = await contract.afficherParMatriculeEtType(matricule, typeAttestation);
		return { success:true, data: diplome };
	}
	catch(error)
	{
		return { success:false, error:"Attestation non trouver" };

	}
}

async function prepareSignature(attestationData, pdfId, photoId) {
  // Récupérer le typehash du contrat
  const DIPLOME_TYPEHASH = await contract.DIPLOME_TYPEHASH();
  
  const domain = {
    name: "DiplomaChain Niger",
    version: "1.0.0",
    chainId: parseInt(process.env.CHAIN_ID),
    verifyingContract: process.env.CONTRACT_ADDRESS
  };
  
  // Structure du message (l'ordre est crucial)
  const types = {
    Diplome: [
      { name: "nom", type: "string" },
      { name: "prenom", type: "string" },
      { name: "typeAttestation", type: "string" },
      { name: "matricule", type: "string" },
      { name: "filiere", type: "string" },
      { name: "dateObtention", type: "uint256" },
      { name: "mention", type: "string" },
      { name: "hashAttestation", type: "string" },
      { name: "hashPhoto", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "contractAddress", type: "address" },
      { name: "universiteId", type: "bytes32" }
    ]
  };
  
  // Récupérer universiteId
  const universiteId = await contract.universiteId();
  
  // Préparer le message
  const message = {
    nom: attestationData.nom,
    prenom: attestationData.prenom,
    typeAttestation: attestationData.typeAttestation,
    matricule: attestationData.matricule,
    filiere: attestationData.filiere,
    dateObtention: attestationData.dateObtention,
    mention: attestationData.mention,
    hashAttestation: pdfId,
    hashPhoto: photoId,
    chainId: domain.chainId,
    contractAddress: domain.verifyingContract,
    universiteId: universiteId
  };
  
  // Important : le typehash du contrat est utilisé pour la signature
  return { domain, types, message, typehash: DIPLOME_TYPEHASH };
}


// Fonction pour envoyer la transaction (appelée après signature)

// Une seule fonction pour préparer la signature

async function prepareSignatureData(attestationData, pdfId, photoId) {
  const { domain, types, message, typehash } = await prepareSignature(attestationData, pdfId, photoId);
  
  return {
    success: true,
    data: {
      domain,
      types,
      message,
      typehash,  // ← ajoute ceci
      contractAddress: process.env.CONTRACT_ADDRESS
    }
  };
}

module.exports = {getAttestation, listDiplome, getNomUniversite, prepareSignature,prepareSignatureData};