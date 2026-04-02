
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

contract Attestation is AccessControl, Pausable, EIP712 {
    using ECDSA for bytes32;

    bytes32 public constant REVOKER_ROLE = keccak256("REVOKER_ROLE");
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    enum Status { NONE, ACTIVE, REVOKED }

    // 🔥 AJOUT : deadline pour expirations de signature
    bytes32 public constant DIPLOME_TYPEHASH = keccak256(
        "Diplome("
        "string nom,"
        "string prenom,"
        "string typeAttestation,"
        "string matricule,"
        "string filiere,"
        "uint256 dateObtention,"
        "string mention,"
        "string hashAttestation,"
        "string hashPhoto,"
        "uint256 chainId,"
        "address contractAddress,"
        "bytes32 universiteId"
        ")"
    );

    struct Diplome {
        string nom;
        string prenom;
        string typeAttestation;
        string matricule;
        string filiere;
        uint256 dateObtention;
        string mention;
        string hashAttestation;
        string hashPhoto;
        Status status;
        bytes32 signatureHash;
        address signataire;
        uint256 timestamp;
        bytes32 universiteId;
    }

    // =============================================
    // 🔥 MAPPINGS OPTIMISÉS (O(1) partout)
    // =============================================
    mapping(bytes32 => Diplome) public diplomes;
    mapping(bytes32 => bool) public idExiste;
    mapping(bytes32 => bytes32[]) public historiqueParMatricule;
    mapping(bytes32 => bool) public signatureUtilisee;
    mapping(bytes32 => bool) public contenuUnique;
    
    // 🔥 SÉPARATION DES RESPONSABILITÉS
    mapping(bytes32 => bytes32) public idParMatriculeEtType;
    mapping(bytes32 => bool) public actifParCle;
    
    // 🔥 OPTIMISATION : Suppression O(1) avec index
    mapping(bytes32 => mapping(bytes32 => uint256)) public indexActifs;
    mapping(bytes32 => bytes32[]) public actifsParMatricule;

    bytes32[] public tousLesIds;

    string public universiteNom;
    bytes32 public universiteId;

    // =============================================
    // 🔥 EVENTS
    // =============================================
    event DiplomeAjouter(
        bytes32 indexed id,
        bytes32 indexed matriculeHash,
        bytes32 indexed typeHash,
        address signataire,
        uint256 timestamp,
        string typeAttestation
    );
    event DiplomeRevoquer(
        bytes32 indexed id,
        bytes32 indexed matriculeHash,
        bytes32 indexed typeHash,
        address emetteur
    );
    event DiplomeRecree(
        bytes32 indexed id,
        bytes32 indexed matriculeHash,
        bytes32 indexed typeHash,
        address signataire,
        uint256 timestamp
    );
    event RelayerAjoute(address indexed relayer, address indexed admin);
    event RelayerRetire(address indexed relayer, address indexed admin);

    // =============================================
    // 🔥 MODIFIERS
    // =============================================
    modifier nonVide(string memory _data) {
        require(bytes(_data).length > 0, "Champ vide");
        _;
    }

    modifier dateValide(uint256 _timestamp) {
        require(_timestamp <= block.timestamp, "Date future");
        _;
    }

    

    modifier seulementRelayer() {
        require(hasRole(RELAYER_ROLE, msg.sender), "Non autorise");
        _;
    }

    modifier paginationValide(uint256 _itemsParPage) {
        require(_itemsParPage > 0 && _itemsParPage <= 100, "Pagination invalide (1-100)");
        _;
    }

    // =============================================
    // 🔥 CONSTRUCTOR
    // =============================================
    constructor(string memory _universiteNom)
        EIP712("DiplomaChain Niger", "1.0.0")
    {
        universiteNom = _universiteNom;
        universiteId = keccak256(bytes(_universiteNom));

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REVOKER_ROLE, msg.sender);
        _grantRole(RELAYER_ROLE, msg.sender);
    }

    // =============================================
    // 🔥 FONCTIONS ADMIN
    // =============================================
    function ajouterRelayer(address _relayer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(RELAYER_ROLE, _relayer);
        emit RelayerAjoute(_relayer, msg.sender);
    }

    function retirerRelayer(address _relayer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(RELAYER_ROLE, _relayer);
        emit RelayerRetire(_relayer, msg.sender);
    }

    // =============================================
    // 🔥 FONCTION PRINCIPALE : AJOUTER UN DIPLÔME
    // =============================================
    function ajouter(
        string memory _nom,
        string memory _prenom,
        string memory _typeAttestation,
        string memory _matricule,
        string memory _filiere,
        uint256 _dateObtention,
        string memory _mention,
        string memory _hashAttestation,
        string memory _hashPhoto,
        bytes calldata _signature
    )
        external
        whenNotPaused
        nonVide(_nom)
        nonVide(_prenom)
        nonVide(_typeAttestation)
        nonVide(_matricule)
        nonVide(_filiere)
        nonVide(_hashAttestation)
        nonVide(_hashPhoto)
        dateValide(_dateObtention)
        seulementRelayer
        returns (bytes32)
    {
        // 1. Construction des hashes
        bytes32 structHash = keccak256(abi.encode(
            DIPLOME_TYPEHASH,
            keccak256(bytes(_nom)),
            keccak256(bytes(_prenom)),
            keccak256(bytes(_typeAttestation)),
            keccak256(bytes(_matricule)),
            keccak256(bytes(_filiere)),
            _dateObtention,
            keccak256(bytes(_mention)),
            keccak256(bytes(_hashAttestation)),
            keccak256(bytes(_hashPhoto)),
            block.chainid,
            address(this),
            universiteId
        ));

        bytes32 hash = _hashTypedDataV4(structHash);
        bytes32 matriculeHash = keccak256(bytes(_matricule));
        bytes32 typeHash = keccak256(bytes(_typeAttestation));
        bytes32 cleUnique = keccak256(abi.encode(matriculeHash, typeHash));
        
        // Anti-duplication de contenu
        bytes32 contenuHash = keccak256(abi.encode(_hashAttestation, _hashPhoto));
        require(!contenuUnique[contenuHash], "Contenu deja existe");

        // ID technique
        bytes32 id = keccak256(abi.encode(
            matriculeHash,
            typeHash,
            keccak256(bytes(_hashAttestation)),
            _dateObtention,
            hash
        ));

        // Vérifications
        require(!idExiste[id], "ID technique existe");
        require(!signatureUtilisee[hash], "Signature utilisee");
        require(!actifParCle[cleUnique], "Un diplome actif du meme type existe");

        // Signature
        address signer = ECDSA.recover(hash, _signature);
        require(signer != address(0), "Signature invalide");
        require(hasRole(RELAYER_ROLE, signer), "Signataire non relayer");
        require(signer == msg.sender, "Doit signer lui-meme");
        signatureUtilisee[hash] = true;

        // Stockage
        diplomes[id] = Diplome({
            nom: _nom,
            prenom: _prenom,
            typeAttestation: _typeAttestation,
            matricule: _matricule,
            filiere: _filiere,
            dateObtention: _dateObtention,
            mention: _mention,
            hashAttestation: _hashAttestation,
            hashPhoto: _hashPhoto,
            status: Status.ACTIVE,
            signatureHash: hash,
            signataire: signer,
            timestamp: block.timestamp,
            universiteId: universiteId
        });

        // Mise à jour des mappings
        idExiste[id] = true;
        contenuUnique[contenuHash] = true;
        tousLesIds.push(id);
        historiqueParMatricule[matriculeHash].push(id);
        idParMatriculeEtType[cleUnique] = id;
        actifParCle[cleUnique] = true;
        
        actifsParMatricule[matriculeHash].push(id);
        indexActifs[matriculeHash][id] = actifsParMatricule[matriculeHash].length - 1;

        emit DiplomeAjouter(id, matriculeHash, typeHash, signer, block.timestamp, _typeAttestation);

        return id;
    }

    // =============================================
    // 🔥 RÉVOCATION OPTIMISÉE O(1)
    // =============================================
    function revoquerParMatriculeEtType(string memory _matricule, string memory _typeAttestation)
        external
        onlyRole(REVOKER_ROLE)
    {
        bytes32 matriculeHash = keccak256(bytes(_matricule));
        bytes32 typeHash = keccak256(bytes(_typeAttestation));
        bytes32 cleUnique = keccak256(abi.encode(matriculeHash, typeHash));

        bytes32 idADevoquer = idParMatriculeEtType[cleUnique];
        require(idADevoquer != bytes32(0), "Diplome non trouve");
        require(diplomes[idADevoquer].status == Status.ACTIVE, "Deja revoque");

        // 🔥 CORRECTION : Libérer le contenu pour recréation
        bytes32 contenuHash = keccak256(abi.encode(
            diplomes[idADevoquer].hashAttestation,
            diplomes[idADevoquer].hashPhoto
        ));
        contenuUnique[contenuHash] = false;

        // Mettre à jour le statut
        diplomes[idADevoquer].status = Status.REVOKED;
        actifParCle[cleUnique] = false;
        
        // Suppression O(1) des actifs
        bytes32[] storage actifs = actifsParMatricule[matriculeHash];
        require(actifs.length > 0, "Aucun actif");
        
        uint256 index = indexActifs[matriculeHash][idADevoquer];
        require(actifs[index] == idADevoquer, "Index invalide");
        
        uint256 lastIndex = actifs.length - 1;
        
        if (index != lastIndex) {
            bytes32 lastId = actifs[lastIndex];
            actifs[index] = lastId;
            indexActifs[matriculeHash][lastId] = index;
        }
        actifs.pop();
        delete indexActifs[matriculeHash][idADevoquer];

        emit DiplomeRevoquer(idADevoquer, matriculeHash, typeHash, msg.sender);
    }

    // =============================================
    // 🔥 FONCTIONS DE LECTURE
    // =============================================
    
    function existeHistorique(string memory _matricule, string memory _typeAttestation) 
        external 
        view 
        returns (bool) 
    {
        bytes32 matriculeHash = keccak256(bytes(_matricule));
        bytes32 typeHash = keccak256(bytes(_typeAttestation));
        bytes32 cleUnique = keccak256(abi.encode(matriculeHash, typeHash));

        return idParMatriculeEtType[cleUnique] != bytes32(0);
    }

    function existeActif(string memory _matricule, string memory _typeAttestation) 
        external 
        view 
        returns (bool) 
    {
        bytes32 matriculeHash = keccak256(bytes(_matricule));
        bytes32 typeHash = keccak256(bytes(_typeAttestation));
        bytes32 cleUnique = keccak256(abi.encode(matriculeHash, typeHash));

        return actifParCle[cleUnique];
    }

    function afficherParMatriculeEtType(string memory _matricule, string memory _typeAttestation) 
        external 
        view 
        returns (Diplome memory) 
    {
        bytes32 matriculeHash = keccak256(bytes(_matricule));
        bytes32 typeHash = keccak256(bytes(_typeAttestation));
        bytes32 cleUnique = keccak256(abi.encode(matriculeHash, typeHash));
        
        bytes32 id = idParMatriculeEtType[cleUnique];
        require(id != bytes32(0), "Diplome non trouve");
        
        return diplomes[id];
    }

    function afficherActifs(string memory _matricule) 
        external 
        view 
        returns (Diplome[] memory) 
    {
        bytes32 matriculeHash = keccak256(bytes(_matricule));
        bytes32[] storage actifs = actifsParMatricule[matriculeHash];
        uint256 length = actifs.length;
        
        Diplome[] memory resultat = new Diplome[](length);
        for (uint256 i = 0; i < length; i++) {
            resultat[i] = diplomes[actifs[i]];
        }
        return resultat;
    }

    function afficherHistorique(string memory _matricule) 
        external 
        view 
        returns (Diplome[] memory) 
    {
        bytes32 matriculeHash = keccak256(bytes(_matricule));
        bytes32[] storage historique = historiqueParMatricule[matriculeHash];
        uint256 length = historique.length;
        
        Diplome[] memory resultat = new Diplome[](length);
        for (uint256 i = 0; i < length; i++) {
            resultat[i] = diplomes[historique[i]];
        }
        return resultat;
    }

    function afficherHistoriquePaginated(
        string memory _matricule, 
        uint256 _page, 
        uint256 _itemsParPage
    ) 
        external 
        view 
        paginationValide(_itemsParPage)
        returns (Diplome[] memory) 
    {
        bytes32 matriculeHash = keccak256(bytes(_matricule));
        bytes32[] storage historique = historiqueParMatricule[matriculeHash];
        uint256 total = historique.length;
        
        if (total == 0) return new Diplome[](0);
        
        uint256 debut = _page * _itemsParPage;
        if (debut >= total) return new Diplome[](0);
        
        uint256 fin = debut + _itemsParPage;
        if (fin > total) fin = total;
        
        uint256 taille = fin - debut;
        Diplome[] memory resultat = new Diplome[](taille);
        
        for (uint256 i = 0; i < taille; i++) {
            resultat[i] = diplomes[historique[debut + i]];
        }
        
        return resultat;
    }

    function afficherParId(bytes32 _id) external view returns (Diplome memory) {
        require(idExiste[_id], "Inexistant");
        return diplomes[_id];
    }

    function getHistorique(string memory _matricule) external view returns (bytes32[] memory)
    {
        return historiqueParMatricule[keccak256(bytes(_matricule))];
    }

    // =============================================
    // 🔥 PAGINATION GLOBALE
    // =============================================
    function listerDiplomes(uint256 _page, uint256 _itemsParPage) 
        external 
        view 
        paginationValide(_itemsParPage)
        returns (Diplome[] memory) 
    {
        uint256 total = tousLesIds.length;
        if (total == 0) return new Diplome[](0);

        uint256 debut = _page * _itemsParPage;
        if (debut >= total) return new Diplome[](0);

        uint256 fin = debut + _itemsParPage;
        if (fin > total) fin = total;

        uint256 taille = fin - debut;
        Diplome[] memory resultat = new Diplome[](taille);

        for (uint256 i = 0; i < taille; i++) {
            resultat[i] = diplomes[tousLesIds[debut + i]];
        }

        return resultat;
    }

    function totalPages(uint256 _itemsParPage) 
        external 
        view 
        paginationValide(_itemsParPage)
        returns (uint256) 
    {
        if (tousLesIds.length == 0) return 0;
        return (tousLesIds.length + _itemsParPage - 1) / _itemsParPage;
    }

    // =============================================
    // 🔥 CONTROLE
    // =============================================
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}

