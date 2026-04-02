const express = require('express');

const { prepareSignature, listDiplome, getAttestation } = require('./blockchaine.js');

const router = express.Router();

// Route POST /api/prepare-signature

router.post('/prepare-signature', async (req, res) =>{
	try
	{
		const { attestationData, pdfId, photoId } = req.body;
		const result = await prepareSignature(attestationData,pdfId, photoId);
		res.json(result);
	}
	catch(error)
	{
		res.status(500).json({success: false, error: error.message});
	}
});

//api/attestation/:matricule/:type
router.get('/attestation/:matricule/:type', async (req, res) => {
  try {
    const { matricule, type } = req.params;
    
   	const result = await getAttestation(matricule, type);
   	if (!result.success) 
   	{
   		return res.status(404).json(result);
   	}
   	res.json(result);
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/diplomes', async (req, res)=>{
	try
	{
		const page =  parseInt(req.query.page) || 0;
		const limit = parseInt(req.query.limit) || 10;
		const diplomes = await listDiplome(page, limit);
		res.json(diplomes);
	}
	catch(error)
	{
		res.status(500).json({ success: false, error: error.message });
	}
});

// Dans routes.js
router.get('/contract-address', (req, res) => {
    res.json({ address: process.env.CONTRACT_ADDRESS });
});

// Route pour donner la configuration au frontend
router.get('/config', (req, res) => {
    res.json({ 
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5500'
    });
});

module.exports = router;