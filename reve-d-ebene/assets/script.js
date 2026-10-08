const sections = document.querySelectorAll(".question-section");
const btnSuivant = document.querySelectorAll(".suivant");
const btnRetour = document.querySelectorAll(".retour");
const STORAGE_DATA_KEY = "formData";
const STORAGE_QUESTION_KEY = "currentQuestion";
const STORAGE_STATUS_KEY = "formStatus";
const STORAGE_SUBMISSION_KEY = "surveySubmissionId";
const FORM_SCHEMA_VERSION = 1;

const anciensNoms = {
    choix: "age",
    question2: "purchase_frequency",
    "question3[]": "products",
    question4: "desired_products",
    question5: "makeup_style",
    question6: "preferred_texture",
    "question7[]": "colors",
    "question8[]": "brand_issues",
    question9: "gloss_budget",
    "question10[]": "purchase_triggers",
    question11: "packaging_style",
    question12: "purchase_channel",
    question13: "local_brand_interest",
    question14: "followed_influencer",
    question15: "ideal_brand"
};

const anciennesValeurs = {
    age: { "-16 ans": "under_16", "16-18 ans": "age_16_18", "19-22 ans": "age_19_22", "23-27ans": "age_23_27", "28+": "age_28_plus" },
    purchase_frequency: { tres_souvent: "very_often", "1_fois_par_mois": "monthly", occasionnellement: "occasionally", rarement: "rarely" },
    products: { rouge_a_levres: "lipstick", fond_de_teint: "foundation", poudre: "powder", faux_cils: "false_eyelashes" },
    makeup_style: { naturel: "natural", makeup_artistique: "artistic_trendy" },
    preferred_texture: { mat: "matte", cremeux: "creamy", leger: "lightweight_natural", tres_pigmente: "highly_pigmented" },
    colors: { brun_caramel: "brown_caramel", rose: "pink", rouge: "red", corail_sunset: "coral_sunset", bordeaux_chocolat: "burgundy_chocolate" },
    brand_issues: { pas_as_se_teintes: "insufficient_shades", mauvaise_tenue: "poor_wear", trop_cher: "too_expensive", packaging_pas_beau: "unattractive_packaging", produits_difficiles_a_trouver: "hard_to_find", qualite_moyenne: "average_quality", pas_as_tendance: "not_trendy_enough" },
    gloss_budget: { "15_25k": "ar_15_25k", "25_40k": "ar_25_40k", "40_60k": "ar_40_60k", "60k_plus": "ar_60k_plus" },
    purchase_triggers: { influenceurs: "influencers", qualite: "quality", prix: "price", produits_trend: "trendy_products", avis_clients: "customer_reviews" },
    packaging_style: { luxe_minimaliste: "luxury_minimalist", colore_fun: "colorful_fun", glossy_moderne: "modern_glossy" },
    purchase_channel: { revendeurs: "resellers", centre_commercial: "shopping_mall", marches: "markets" },
    local_brand_interest: { oui: "yes", peut_etre: "maybe", non: "no" }
};

function lireStockage(cle) {
    try {
        return localStorage.getItem(cle);
    } catch (error) {
        console.warn("Stockage local indisponible.", error);
        return null;
    }
}

function ecrireStockage(cle, valeur) {
    try {
        localStorage.setItem(cle, valeur);
        return true;
    } catch (error) {
        console.warn("Impossible d’enregistrer localement.", error);
        return false;
    }
}

function supprimerStockage(cle) {
    try {
        localStorage.removeItem(cle);
    } catch (error) {
        console.warn("Impossible de nettoyer le stockage local.", error);
    }
}

function lireJsonStocke(cle) {
    const valeur = lireStockage(cle);
    if (valeur === null) return null;

    try {
        return JSON.parse(valeur);
    } catch (error) {
        supprimerStockage(cle);
        return null;
    }
}

function genererIdentifiantSoumission() {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

    const octets = crypto.getRandomValues(new Uint8Array(16));
    octets[6] = (octets[6] & 0x0f) | 0x40;
    octets[8] = (octets[8] & 0x3f) | 0x80;
    const hex = [...octets].map(octet => octet.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function obtenirIdentifiantSoumission() {
    const identifiant = lireStockage(STORAGE_SUBMISSION_KEY);
    const formatUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (identifiant && formatUuid.test(identifiant)) return identifiant;

    const nouvelIdentifiant = genererIdentifiantSoumission();
    ecrireStockage(STORAGE_SUBMISSION_KEY, nouvelIdentifiant);
    return nouvelIdentifiant;
}

function lireQuestionCourante() {
    try {
        const valeurSession = sessionStorage.getItem(STORAGE_QUESTION_KEY);
        if (valeurSession !== null) return valeurSession;

        const ancienneValeur = lireStockage(STORAGE_QUESTION_KEY);
        if (ancienneValeur !== null) {
            sessionStorage.setItem(STORAGE_QUESTION_KEY, ancienneValeur);
            supprimerStockage(STORAGE_QUESTION_KEY);
        }
        return ancienneValeur;
    } catch (error) {
        console.warn("Session locale indisponible.", error);
        return lireStockage(STORAGE_QUESTION_KEY);
    }
}

function ecrireQuestionCourante(valeur) {
    try {
        sessionStorage.setItem(STORAGE_QUESTION_KEY, valeur);
        supprimerStockage(STORAGE_QUESTION_KEY);
    } catch (error) {
        console.warn("Impossible d’enregistrer la question courante dans la session.", error);
        ecrireStockage(STORAGE_QUESTION_KEY, valeur);
    }
}

function normaliserDonnees(savedData) {
    if (!savedData || typeof savedData !== "object" || Array.isArray(savedData)) {
        return {};
    }

    const donneesMigrees = { ...savedData };

    Object.entries(anciensNoms).forEach(([ancienNom, nouveauNom]) => {
        if (donneesMigrees[nouveauNom] === undefined && donneesMigrees[ancienNom] !== undefined) {
            donneesMigrees[nouveauNom] = donneesMigrees[ancienNom];
        }
    });

    const data = {};
    const champsParNom = new Map();

    document.querySelectorAll("input[name], textarea[name]").forEach(input => {
        if (!champsParNom.has(input.name)) champsParNom.set(input.name, []);
        champsParNom.get(input.name).push(input);
    });

    champsParNom.forEach((inputs, nom) => {
        const premiereEntree = inputs[0];
        const correspondances = anciennesValeurs[nom] || {};
        const convertir = valeur => correspondances[valeur] || valeur;
        const valeursPermises = new Set(inputs.map(input => input.value));
        const valeurSauvegardee = donneesMigrees[nom];

        if (premiereEntree.type === "checkbox") {
            const valeurs = Array.isArray(valeurSauvegardee) ? valeurSauvegardee : [];
            data[nom] = valeurs.map(convertir).filter(valeur => valeursPermises.has(valeur));
        } else if (premiereEntree.type === "radio") {
            const valeur = typeof valeurSauvegardee === "string" ? convertir(valeurSauvegardee) : null;
            if (valeur && valeursPermises.has(valeur)) data[nom] = valeur;
        } else if (typeof valeurSauvegardee === "string") {
            data[nom] = valeurSauvegardee;
        }
    });

    return data;
}

// --- SAUVEGARDE CIBLÉE DES RÉPONSES ---
function sauvegarderChamp(input) {
    if (!input?.name) return;

    const data = normaliserDonnees(lireJsonStocke(STORAGE_DATA_KEY));

    if (input.type === "checkbox") {
        const valeurs = new Set(Array.isArray(data[input.name]) ? data[input.name] : []);
        if (input.checked) valeurs.add(input.value);
        else valeurs.delete(input.value);
        data[input.name] = [...valeurs];
    } else if (input.type !== "radio" || input.checked) {
        data[input.name] = input.value;
    }

    ecrireStockage(STORAGE_DATA_KEY, JSON.stringify(data));
}

function lireStatutSauvegarde() {
    const statut = lireJsonStocke(STORAGE_STATUS_KEY);
    return statut && typeof statut === "object" && !Array.isArray(statut) ? statut : null;
}

function marquerEnCours() {
    const statutPrecedent = lireStatutSauvegarde();

    ecrireStockage(STORAGE_STATUS_KEY, JSON.stringify({
        status: "in_progress",
        submissionId: statutPrecedent?.submissionId || obtenirIdentifiantSoumission(),
        updatedAt: new Date().toISOString()
    }));
}

function validerStatutSauvegarde() {
    const statutBrut = lireStockage(STORAGE_STATUS_KEY);
    if (statutBrut === null) return;

    const statut = lireJsonStocke(STORAGE_STATUS_KEY);
    const statutsValides = new Set(["in_progress", "completed_locally", "pending_sync", "submitted"]);

    if (
        statut === null ||
        typeof statut !== "object" ||
        Array.isArray(statut) ||
        !statutsValides.has(statut.status)
    ) {
        supprimerStockage(STORAGE_STATUS_KEY);
    }
}


// --- RESTAURATION DES RÉPONSES ---
function restaurerDonnees() {
    const donneesBrutes = lireStockage(STORAGE_DATA_KEY);
    if (donneesBrutes === null) return;

    const donneesStockees = lireJsonStocke(STORAGE_DATA_KEY);

    if (!donneesStockees || typeof donneesStockees !== "object" || Array.isArray(donneesStockees)) {
        supprimerStockage(STORAGE_DATA_KEY);
        return;
    }

    const savedData = normaliserDonnees(donneesStockees);

    document.querySelectorAll("input, textarea").forEach(input => {
        if (!input.name) return;

        if (input.type === "radio") {
            input.checked = savedData[input.name] === input.value;
        } 
        
        else if (input.type === "checkbox") {
            input.checked = (
                Array.isArray(savedData[input.name]) &&
                savedData[input.name].includes(input.value)
            );
        } 
        
        else {
            input.value = savedData[input.name] || "";
        }
    });

    ecrireStockage(STORAGE_DATA_KEY, JSON.stringify(savedData));
}

// --- NAVIGATION : LIRE LA PAGE SAUVEGARDÉE ---
let current = parseInt(lireQuestionCourante(), 10);

if (!Number.isInteger(current) || current < 0 || current >= sections.length) {
    current = 0;
    ecrireQuestionCourante("0");
}

function mettreAJourProgression(questionPrecedente = null) {
    const totalQuestions = sections.length;

    sections.forEach((section, index) => {
        const numeroQuestion = index + 1;
        const progression = (index / (totalQuestions - 1)) * 100;
        const titreProgression = section.querySelector("h3");
        const pisteProgression = section.querySelector(".contenant");
        const barreProgression = section.querySelector(".barre-progression");

        if (titreProgression) {
            titreProgression.textContent = `Question ${numeroQuestion}/${totalQuestions}`;
        }

        if (pisteProgression && barreProgression) {
            if (index === current && questionPrecedente !== null) {
                const progressionPrecedente = (questionPrecedente / (totalQuestions - 1)) * 100;

                barreProgression.style.transition = "none";
                barreProgression.style.width = `${progressionPrecedente}%`;
                barreProgression.offsetWidth;
                barreProgression.style.transition = "";

                requestAnimationFrame(() => {
                    barreProgression.style.width = `${progression}%`;
                });
            } else {
                barreProgression.style.width = `${progression}%`;
            }

            pisteProgression.setAttribute("role", "progressbar");
            pisteProgression.setAttribute("aria-label", `Progression du questionnaire : question ${numeroQuestion} sur ${totalQuestions}`);
            pisteProgression.setAttribute("aria-valuemin", "0");
            pisteProgression.setAttribute("aria-valuemax", "100");
            pisteProgression.setAttribute("aria-valuenow", progression.toFixed(2));
        }
    });
}

sections.forEach(section => section.classList.remove("active"));
sections[current].classList.add("active");

validerStatutSauvegarde();
obtenirIdentifiantSoumission();
restaurerDonnees();
mettreAJourProgression();

let alerteTimeout; 

function afficherNotification(message) {
    let alerte = document.getElementById("custom-alert");
    
    if (!alerte) {
        alerte = document.createElement("div");
        alerte.id = "custom-alert";
        document.body.appendChild(alerte);
    }
    
    clearTimeout(alerteTimeout);
    
    alerte.textContent = message;
    alerte.classList.add("show");
    
    alerteTimeout = setTimeout(() => {
        alerte.classList.remove("show");
    }, 3000);
}


// BOUTON SUIVANT
btnSuivant.forEach((bouton) => {
    bouton.addEventListener("click", (e) => {
        e.preventDefault();
        const sectionActuelle = sections[current];

        // VÉRIFICATION DES BOUTONS RADIO
        const radios = sectionActuelle.querySelectorAll('input[type="radio"]');
        if (radios.length > 0) {
            const unRadioEstCoche = Array.from(radios).some(radio => radio.checked);
            
            if (!unRadioEstCoche) {
                afficherNotification("Veuillez sélectionner une option avant de continuer.");
                return; 
            }
        }

        
        // VÉRIFICATION DES CASES À COCHER (CHECKBOX)
        const checkboxes = sectionActuelle.querySelectorAll('input[type="checkbox"]');
        if (checkboxes.length > 0) {
            const totalCoches = Array.from(checkboxes).filter(cb => cb.checked).length;
            
            if (totalCoches < 1) {
                afficherNotification("Veuillez cocher au moins 1 option pour continuer.");
                return; 
            }
        }

        // VÉRIFICATION DES INPUTS TEXTE ET TEXTAREA + LIMITES DE CARACTÈRES
        const textInputs = sectionActuelle.querySelectorAll('input[type="text"], textarea');
        if (textInputs.length > 0) {
            let unChampEstVide = false;
            let limiteNonRespectee = false;
            let messageErreur = "Veuillez remplir ce champ avant de continuer.";

            textInputs.forEach(input => {
                if (input.name === "ideal_brand") return; 
                
                const valeur = input.value.trim();
                if (valeur === "") {
                    unChampEstVide = true;
                } else {
                    const minLength = input.getAttribute("minlength");
                    if (minLength && valeur.length < parseInt(minLength)) {
                        limiteNonRespectee = true;
                        messageErreur = `Votre réponse doit contenir au moins ${minLength} caractères.`;
                    }
                }
            });

            if (unChampEstVide || limiteNonRespectee) {
                afficherNotification(messageErreur);
                return; 
            }
        }
        viderSauvegardeTexte();
        if (current < sections.length - 1) {
            const questionPrecedente = current;

            sections[current].classList.remove("active");
            current++;
            sections[current].classList.add("active");
            
            ecrireQuestionCourante(String(current));
            mettreAJourProgression(questionPrecedente);
        }
    });
});


function obtenirConfigurationSupabase() {
    const configuration = window.SUPABASE_CONFIG;
    const url = configuration?.url?.trim().replace(/\/+$/, "");
    const publishableKey = configuration?.publishableKey?.trim();

    if (!url || !publishableKey) return null;

    try {
        const adresse = new URL(url);
        const protocoleValide = adresse.protocol === "https:" || ["localhost", "127.0.0.1"].includes(adresse.hostname);
        return protocoleValide ? { url, publishableKey } : null;
    } catch (error) {
        return null;
    }
}

function reponsesCompletes(data) {
    const champsTexte = [
        "age", "purchase_frequency", "desired_products", "makeup_style",
        "preferred_texture", "gloss_budget", "packaging_style",
        "purchase_channel", "local_brand_interest", "followed_influencer"
    ];
    const champsMultiples = ["products", "colors", "brand_issues", "purchase_triggers"];

    return champsTexte.every(nom => typeof data[nom] === "string" && data[nom].trim().length > 0)
        && champsMultiples.every(nom => Array.isArray(data[nom]) && data[nom].length > 0)
        && data.desired_products.trim().length >= 3
        && data.desired_products.length <= 500
        && data.followed_influencer.trim().length >= 3
        && data.followed_influencer.length <= 500
        && (typeof data.ideal_brand !== "string" || data.ideal_brand.length <= 2000);
}

function enregistrerSoumissionEnAttente(data) {
    const statutPrecedent = lireStatutSauvegarde();
    const statut = {
        status: "pending_sync",
        submissionId: obtenirIdentifiantSoumission(),
        schemaVersion: FORM_SCHEMA_VERSION,
        completedAt: statutPrecedent?.completedAt || new Date().toISOString(),
        currentQuestion: current
    };

    ecrireStockage(STORAGE_DATA_KEY, JSON.stringify(data));
    ecrireStockage(STORAGE_STATUS_KEY, JSON.stringify(statut));
    return statut;
}

async function envoyerVersSupabase(configuration, statut, data) {
    const controleur = new AbortController();
    const expiration = setTimeout(() => controleur.abort(), 10000);

    try {
        const reponse = await fetch(`${configuration.url}/rest/v1/rpc/submit_survey_response`, {
            method: "POST",
            headers: {
                apikey: configuration.publishableKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                p_submission_id: statut.submissionId,
                p_schema_version: statut.schemaVersion,
                p_answers: data,
                p_client_completed_at: statut.completedAt
            }),
            signal: controleur.signal
        });

        if (!reponse.ok) throw new Error(`Supabase HTTP ${reponse.status}`);

        const resultat = await reponse.json();
        if (!["stored", "already_stored"].includes(resultat)) {
            throw new Error("Réponse Supabase inattendue");
        }

        return resultat;
    } finally {
        clearTimeout(expiration);
    }
}

let envoiEnCours = null;

function synchroniserSoumission() {
    if (envoiEnCours) return envoiEnCours;

    const configuration = obtenirConfigurationSupabase();
    const statut = lireStatutSauvegarde();
    const data = normaliserDonnees(lireJsonStocke(STORAGE_DATA_KEY));
    const synchronisable = statut && ["completed_locally", "pending_sync"].includes(statut.status);

    if (!configuration || !navigator.onLine || !synchronisable || !reponsesCompletes(data)) {
        return Promise.resolve(false);
    }

    const statutEnAttente = enregistrerSoumissionEnAttente(data);

    envoiEnCours = envoyerVersSupabase(configuration, statutEnAttente, data)
        .then(resultat => {
            ecrireStockage(STORAGE_STATUS_KEY, JSON.stringify({
                ...statutEnAttente,
                status: "submitted",
                result: resultat,
                submittedAt: new Date().toISOString()
            }));
            return true;
        })
        .catch(() => {
            ecrireStockage(STORAGE_STATUS_KEY, JSON.stringify({
                ...statutEnAttente,
                status: "pending_sync",
                lastAttemptAt: new Date().toISOString()
            }));
            return false;
        })
        .finally(() => {
            envoiEnCours = null;
        });

    return envoiEnCours;
}

// --- ENREGISTREMENT LOCAL ET SYNCHRONISATION : BOUTON CONFIRMER ---
document.addEventListener("click", async (e) => {
    const cible = e.target.closest("#btn-confirmer");
    
    if (cible) {
        e.preventDefault();
        e.stopPropagation();

        viderSauvegardeTexte();
        ecrireQuestionCourante(String(current));
        const data = normaliserDonnees(lireJsonStocke(STORAGE_DATA_KEY));

        if (!reponsesCompletes(data)) {
            afficherNotification("Certaines réponses sont manquantes. Vérifiez le questionnaire.");
            return;
        }

        enregistrerSoumissionEnAttente(data);
        afficherNotification("Réponses enregistrées localement. Envoi en cours…");

        const envoiReussi = await synchroniserSoumission();
        afficherNotification(envoiReussi
            ? "Réponses envoyées avec succès."
            : "Réponses conservées localement. L’envoi reprendra automatiquement."
        );
    }
});

// BOUTON RETOUR
btnRetour.forEach((bouton) => {
    bouton.addEventListener("click", (e) => {
        e.preventDefault();

        viderSauvegardeTexte();

        if (current > 0) {
            const questionPrecedente = current;

            sections[current].classList.remove("active");
            current--;
            sections[current].classList.add("active");
            
            ecrireQuestionCourante(String(current));
            mettreAJourProgression(questionPrecedente);
        }
    });
});


// CLIC SUR LES DIV/BLOCS
document.querySelectorAll("form div").forEach((block) => {
    block.addEventListener("click", (e) => {
        if (e.target.closest("input, label")) return;

        const input = block.querySelector("input");
        if (!input) return;

        if (input.type === "radio") {
            input.checked = true;
        }

        if (input.type === "checkbox") {
            input.checked = !input.checked;
        }

        input.dispatchEvent(new Event("change", { bubbles: true }));
    });
});


// SAUVEGARDE IMMÉDIATE DES CHOIX ET DIFFÉRÉE DES TEXTES
document.addEventListener("change", (e) => {
    if (!e.target.matches('input[type="radio"], input[type="checkbox"]')) return;

    sauvegarderChamp(e.target);
    marquerEnCours();
});

let sauvegardeTexteTimeout;
let champTexteEnAttente = null;

function viderSauvegardeTexte() {
    if (!champTexteEnAttente) return;

    clearTimeout(sauvegardeTexteTimeout);
    sauvegarderChamp(champTexteEnAttente);
    marquerEnCours();
    champTexteEnAttente = null;
}

document.addEventListener("input", (e) => {
    if (!e.target.matches("textarea")) return;

    if (champTexteEnAttente && champTexteEnAttente !== e.target) {
        viderSauvegardeTexte();
    }

    champTexteEnAttente = e.target;
    clearTimeout(sauvegardeTexteTimeout);
    sauvegardeTexteTimeout = setTimeout(viderSauvegardeTexte, 250);
});

window.addEventListener("pagehide", viderSauvegardeTexte);
window.addEventListener("online", () => synchroniserSoumission());

setTimeout(() => synchroniserSoumission(), 0);


// TOUCHE ENTRÉE DANS LES TEXTAREAS
document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "TEXTAREA") {
        if (e.key === "Enter") {
            if (!e.shiftKey) {
                e.stopPropagation(); 
            }
        }
    }
});
