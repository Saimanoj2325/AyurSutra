"""
AyurvedaBot API Router - RAG-powered Ayurvedic chatbot using Mistral AI
Uses TF-IDF based retrieval over a comprehensive Ayurvedic knowledge base
"""
import os
import re
import math
import datetime
from collections import Counter
from typing import List, Dict, Optional

from fastapi import APIRouter, HTTPException, Depends
from firebase_config import verify_firebase_token
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# --- Configure OpenAI client to use Mistral API ---
MISTRAL_API_KEY = os.environ.get("MISTRAL_API_KEY")
if MISTRAL_API_KEY:
    client = OpenAI(api_key=MISTRAL_API_KEY, base_url="https://api.mistral.ai/v1")
else:
    client = None
    print("WARNING: MISTRAL_API_KEY environment variable not found.")

# --- FastAPI router ---
router = APIRouter(prefix="/chatbot", tags=["Chatbot"])

# --- Pydantic models ---
class PatientContext(BaseModel):
    name: Optional[str] = None
    dosha: Optional[str] = None
    current_therapy: Optional[str] = None
    treatment_day: Optional[int] = None
    total_treatment_days: Optional[int] = None
    medical_history: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[Dict[str, str]]] = []
    patient_context: Optional[PatientContext] = None

class ChatResponse(BaseModel):
    response: str
    sources: List[str] = []
    source_categories: List[str] = []
    formatted_html: Optional[str] = None
    plain_text: Optional[str] = None

# --- Comprehensive Ayurvedic Knowledge Base ---
AYURVEDIC_KNOWLEDGE = [
    # === DOSHAS ===
    {
        "id": "vata-dosha",
        "content": "Vata dosha governs all movement in the body — blood circulation, breathing, blinking, heartbeat, nerve impulses, and elimination. Composed of air (vayu) and space (akasha) elements. Qualities: dry, light, cold, rough, subtle, mobile, clear. When balanced: creativity, flexibility, vitality, quick comprehension, enthusiasm. When imbalanced: anxiety, insomnia, dry skin, constipation, joint pain, irregular digestion, restlessness, fear, tremors. Vata is seated primarily in the colon, pelvis, bones, ears, and skin. Balancing strategies: warm, cooked, moist foods; regular routine and sleep schedule; warm oil self-massage (Abhyanga); avoid cold, raw foods and irregular habits; favor sweet, sour, salty tastes; minimize bitter, pungent, astringent tastes.",
        "metadata": {"source": "Charaka Samhita & Classical Ayurveda", "category": "Doshas"}
    },
    {
        "id": "pitta-dosha",
        "content": "Pitta dosha controls digestion, metabolism, energy production, and transformation in the body. Composed of fire (agni) and water (jala) elements. Qualities: hot, sharp, light, oily, liquid, spreading, penetrating. When balanced: strong digestion, good intellect, courage, leadership, warm personality, lustrous complexion. When imbalanced: anger, irritability, inflammation, heartburn, acid reflux, skin rashes, excessive sweating, loose stools, bleeding disorders, ulcers, burning sensations. Pitta is seated primarily in the small intestine, stomach, liver, spleen, blood, eyes, and skin. Balancing strategies: cooling foods (cucumber, mint, coconut); avoid excess heat, spicy, sour, salty foods; favor sweet, bitter, astringent tastes; moderate exercise; avoid overwork and competitiveness; moonlight walks; cooling pranayama.",
        "metadata": {"source": "Charaka Samhita & Classical Ayurveda", "category": "Doshas"}
    },
    {
        "id": "kapha-dosha",
        "content": "Kapha dosha provides structure, lubrication, stability, and immunity. Composed of earth (prithvi) and water (jala) elements. Qualities: heavy, cold, slow/dull, oily, smooth, dense, soft, stable, sticky, cloudy. When balanced: strength, endurance, immunity, calmness, compassion, patience, groundedness, good memory. When imbalanced: lethargy, weight gain, congestion, excessive sleep, water retention, attachment, depression, sluggish digestion, diabetes, respiratory issues. Kapha is seated primarily in the chest, throat, lungs, head, stomach, lymph, and fatty tissues. Balancing strategies: light, warm, spicy, dry foods; vigorous daily exercise; stimulating activities; avoid overeating, heavy, sweet, oily foods; favor pungent, bitter, astringent tastes; dry brushing; honey in warm water.",
        "metadata": {"source": "Charaka Samhita & Classical Ayurveda", "category": "Doshas"}
    },
    {
        "id": "dual-doshas",
        "content": "Most people have a dual-dosha constitution (Prakriti). Vata-Pitta: creative and intense, benefits from warmth and routine with cooling elements. Pitta-Kapha: strong and focused, needs balance between stimulation and rest. Vata-Kapha: may alternate between anxiety and lethargy, needs warmth, lightness, and regularity. Understanding your unique Prakriti (birth constitution) vs Vikriti (current imbalance) is essential for personalized Ayurvedic treatment. A trained practitioner assesses pulse (Nadi Pariksha), tongue, eyes, skin, and other markers to determine your constitution accurately.",
        "metadata": {"source": "Classical Ayurveda", "category": "Doshas"}
    },
    # === PANCHAKARMA THERAPIES ===
    {
        "id": "therapy-abhyanga",
        "content": "Abhyanga is a traditional full-body warm oil massage using herb-infused oils customized to the patient's dosha. It is a key preparatory therapy (Purvakarma) in Panchakarma. Benefits: stimulates lymphatic drainage, increases circulation, lubricates joints, pacifies Vata dosha, reduces stress, softens skin, promotes deep sleep, aids toxin elimination, nourishes tissues (dhatus), strengthens immunity. Oils used: Sesame oil (Vata), Coconut oil (Pitta), Mustard oil (Kapha). Duration: 45-60 minutes. Pre-treatment: eat a light meal 2+ hours prior, hydrate with warm water. Post-treatment: rest 15-30 minutes, avoid cold/wind exposure, take a warm shower. Frequency: Daily during Panchakarma, weekly for maintenance. Contraindications: acute fever, acute skin infections, extreme weakness, immediately after meals.",
        "metadata": {"source": "AyurSutra Clinical Guidelines", "category": "Therapies"}
    },
    {
        "id": "therapy-shirodhara",
        "content": "Shirodhara is a profoundly relaxing Panchakarma therapy involving a continuous stream of warm herbal oil, medicated milk, or buttermilk poured onto the forehead (specifically over the Ajna chakra / third eye). It directly stabilizes the nervous system and calms the mind. Primary benefits: deep relaxation, anxiety relief, insomnia treatment, mental fatigue reduction, stress relief, improved concentration, enhanced intuition, headache relief, PTSD support. Duration: 30-45 minutes. Pre-treatment: wash hair, wear comfortable/old clothing (oil will saturate hair), empty bladder. During treatment: close eyes, breathe naturally, allow thoughts to flow. Post-treatment: keep head covered from cold/wind, rest 30-60 minutes, keep oil in hair several hours before gentle wash. Types: Taila Dhara (oil), Takra Dhara (buttermilk), Kshira Dhara (milk), Kwatha Dhara (decoction). Contraindications: recent neck injury, brain tumors, full stomach, intoxication.",
        "metadata": {"source": "AyurSutra Clinical Guidelines", "category": "Therapies"}
    },
    {
        "id": "therapy-basti",
        "content": "Basti (Ayurvedic medicated enema) is considered the most powerful of the five Panchakarma treatments (Pradhanakarma), especially for Vata disorders. Types: Anuvasana Basti (oil-based, nourishing), Niruha/Asthapana Basti (decoction-based, cleansing), Uttara Basti (for reproductive disorders). Benefits: deep colon cleansing, restores gut microbiome, treats chronic constipation, relieves joint pain, addresses neurological disorders, balances Vata, improves fertility, detoxifies lower body. Preparation: perform on empty stomach or 3+ hours after light meal. Post-treatment: rest immediately, lie on left side, consume warm kitchari or rice gruel for the day. Duration: varies (15-45 minutes retention). Course: typically 8-15 sessions in alternating pattern. Contraindications: diarrhea, rectal bleeding, extreme weakness, children under 7, pregnancy.",
        "metadata": {"source": "AyurSutra Clinical Guidelines", "category": "Therapies"}
    },
    {
        "id": "therapy-swedana",
        "content": "Swedana is Ayurvedic herbal steam therapy that induces therapeutic sweating. It dilates body channels (srotas), liquefies accumulated toxins (ama), and facilitates their movement out of tissues into the GI tract for elimination. Usually performed immediately after Abhyanga to maximize detoxification synergy. Types: Bashpa Swedana (herbal steam box), Nadi Swedana (local steam), Pinda Swedana (bolus application), Upanaha Swedana (poultice). Benefits: relieves stiffness, reduces coldness and heaviness, improves circulation, opens pores, relaxes muscles, aids weight management, relieves respiratory congestion. Duration: 15-20 minutes. Post-care: dry off immediately, stay warm, sip warm water, avoid cold drafts for 2 hours. Contraindications: high blood pressure, acute inflammation, skin disorders, excess Pitta, pregnancy, dehydration, fever, anemia.",
        "metadata": {"source": "AyurSutra Clinical Guidelines", "category": "Therapies"}
    },
    {
        "id": "therapy-nasya",
        "content": "Nasya is the administration of herbal oils, juices, decoctions, or medicated powders through the nasal passages. It is one of the five principal Panchakarma treatments, specifically targeting disorders above the clavicle (supraclavicular region). Benefits: cleanses sinuses, improves breathing, enhances mental clarity, treats migraines and chronic headaches, relieves allergies, addresses Vata imbalances of the head, improves voice quality, strengthens sense organs. Types: Virechana Nasya (cleansing), Brumhana Nasya (nourishing), Shamana Nasya (pacifying), Pratimarsha Nasya (daily maintenance with 2 drops). Procedure: facial steam first, then lie back with head tilted, administer drops/powder, inhale gently, rest 5-10 minutes. Post-care: avoid cold air, wind, rain, dust immediately after. Best time: morning on empty stomach. Contraindications: immediately after bathing, eating, drinking alcohol, children under 7.",
        "metadata": {"source": "AyurSutra Clinical Guidelines", "category": "Therapies"}
    },
    {
        "id": "therapy-vamana",
        "content": "Vamana is therapeutic emesis (controlled vomiting) — one of the five main Panchakarma procedures. It is the primary treatment for Kapha disorders. The process involves preparatory oleation and fomentation over several days, followed by administration of emetic herbs to induce controlled vomiting, eliminating excess Kapha from the stomach and respiratory tract. Benefits: treats asthma, chronic cold/cough, skin diseases, diabetes, obesity, lymphatic congestion, hypothyroidism. Preparation: 3-7 days of internal oleation (drinking ghee), Abhyanga, and Swedana. On the day: drink medicated decoction/milk until stomach feels full, then emetic herbs administered. Post-treatment: rest completely, gradually return to normal diet over 3-7 days (Samsarjana Krama). Contraindications: childhood, old age, pregnancy, debility, heart disease, hemorrhage, Vata disorders.",
        "metadata": {"source": "AyurSutra Clinical Guidelines", "category": "Therapies"}
    },
    {
        "id": "therapy-virechana",
        "content": "Virechana is therapeutic purgation — a Panchakarma procedure primarily for Pitta disorders. Medicated laxative herbs are administered after proper preparation to cleanse the liver, gallbladder, and small intestine of excess Pitta and toxins. Benefits: treats skin diseases, chronic fever, jaundice, hyperacidity, digestive disorders, liver disorders, hormonal imbalances, inflammatory conditions. Preparation: 3-7 days of internal oleation and external Abhyanga/Swedana. On the day: take prescribed purgative medicine (Trivrit, Castor oil, etc.) early morning on empty stomach. Post-treatment: strict graduated diet (Samsarjana Krama) for 3-7 days starting with rice water, then rice gruel, then normal food. Contraindications: childhood, old age, pregnancy, weakness, rectal prolapse, diarrhea, bleeding disorders, recent fever.",
        "metadata": {"source": "AyurSutra Clinical Guidelines", "category": "Therapies"}
    },
    {
        "id": "panchakarma-phases",
        "content": "Panchakarma follows three essential phases: 1) PURVAKARMA (Preparation, Days 1-5): Includes Pachana (digestive herbs to kindle Agni), Snehana (internal and external oleation with medicated ghee/oils to loosen toxins), and Swedana (sweating therapy to liquefy toxins and direct them to GI tract). 2) PRADHANAKARMA (Main Treatment, Days 5-10): The five main procedures — Vamana (emesis), Virechana (purgation), Basti (enemas), Nasya (nasal administration), Raktamokshana (blood purification). Only relevant procedures are performed based on the patient's constitution and condition. 3) PASCHATKARMA (Post-treatment, Days 10-14+): Includes Samsarjana Krama (graduated diet), Rasayana (rejuvenation therapy), lifestyle adjustments. This phase is critical for restoring Agni and preventing recurrence. Skipping or rushing any phase undermines the entire treatment.",
        "metadata": {"source": "AyurSutra Clinical Guidelines", "category": "Panchakarma"}
    },
    # === DIET & NUTRITION ===
    {
        "id": "diet-vata",
        "content": "Vata-balancing diet: Favor warm, cooked, moist, slightly oily foods. Best grains: cooked oats, rice, wheat, quinoa (all cooked). Best vegetables: cooked root vegetables — sweet potatoes, carrots, beets, asparagus, green beans (avoid raw). Best fruits: bananas, avocados, mangoes, dates, figs, grapes, oranges (sweet, heavy fruits). Best proteins: chicken, fish, eggs, tofu, mung beans. Best dairy: warm milk with ghee, paneer, fresh yogurt. Spices: ginger, cinnamon, cardamom, cumin, fennel, asafoetida (hing), black pepper, turmeric. Oils: sesame oil (primary), ghee, olive oil. Avoid: raw salads, dried fruits, beans (except mung), cold cereals, caffeine, carbonated drinks, crackers, popcorn. Eating habits: regular mealtimes, eat in calm environment, warm beverages, eat largest meal at lunch.",
        "metadata": {"source": "Ashtanga Hridayam & Clinical Practice", "category": "Diet & Nutrition"}
    },
    {
        "id": "diet-pitta",
        "content": "Pitta-balancing diet: Favor cooling, sweet, bitter, and astringent foods. Avoid hot, spicy, sour, and fermented foods. Best grains: basmati rice, wheat, oats, barley. Best vegetables: cucumber, zucchini, leafy greens, asparagus, broccoli, cauliflower, green beans, sweet potato (cooling). Best fruits: sweet grapes, melons, pears, mangoes, pomegranates, coconut, sweet berries. Best proteins: chicken, freshwater fish, mung beans, chickpeas, tofu. Best dairy: milk, ghee, butter, soft cheese (avoid sour/fermented). Spices: coriander, fennel, cardamom, turmeric, mint, saffron, dill (cooling spices). Oils: coconut oil (primary), sunflower oil, ghee. Avoid: chili peppers, tomatoes, onions, garlic, vinegar, sour cream, alcohol, coffee, fermented foods, excess salt. Eating habits: never skip meals, eat at consistent times, main meal at lunch when Pitta digestion is strongest.",
        "metadata": {"source": "Ashtanga Hridayam & Clinical Practice", "category": "Diet & Nutrition"}
    },
    {
        "id": "diet-kapha",
        "content": "Kapha-balancing diet: Favor light, warm, dry, and stimulating foods. Minimize heavy, cold, oily, sweet foods. Best grains: barley, millet, corn, buckwheat, rye (light grains). Best vegetables: all leafy greens, peppers, onions, garlic, radishes, beets, cabbage, mushrooms, cauliflower. Best fruits: apples, pears, pomegranates, cranberries, dried figs, apricots (light, astringent fruits). Best proteins: chicken, turkey, freshwater fish, egg whites, lentils, beans (red and black). Best dairy: small amounts of goat milk, skim milk (reduce dairy overall). Spices: all warming spices — ginger, black pepper, cayenne, turmeric, cinnamon, cloves, mustard seeds, fenugreek. Oils: minimal — small amounts of mustard or sunflower oil. Avoid: excess sugar, ice cream, fried foods, excessive bread/pasta, excess nuts/seeds, cheese, sweet fruits, cold milk. Eating habits: only 2-3 meals daily, no snacking, largest meal at lunch, light dinner before 7 PM, add honey to warm water.",
        "metadata": {"source": "Ashtanga Hridayam & Clinical Practice", "category": "Diet & Nutrition"}
    },
    {
        "id": "diet-panchakarma",
        "content": "During Panchakarma, diet must be strictly modified to support detoxification. PURVAKARMA phase: Internal oleation requires drinking increasing amounts of medicated ghee (Snehapana) for 3-7 days on empty stomach, followed by warm water. Meals should be simple — kitchari (rice + mung dal), warm soups. PRADHANAKARMA phase: Very light diet, mostly liquid — rice gruel (Peya), thin soup (Vilepi). Avoid heavy, cold, spicy foods. PASCHATKARMA phase: Samsarjana Krama (graduated return to normal diet): Day 1-2 rice water, Day 2-3 thin rice gruel, Day 3-4 thick rice gruel, Day 5-6 kitchari with ghee, Day 7+ normal Ayurvedic diet. Throughout Panchakarma: drink warm water exclusively, avoid cold drinks, eat at regular times, no snacking, minimal spices, avoid dairy except ghee, no raw foods, no meat, no alcohol, no caffeine.",
        "metadata": {"source": "AyurSutra Clinical Guidelines", "category": "Diet & Nutrition"}
    },
    {
        "id": "ayurvedic-recipes",
        "content": "Key Ayurvedic healing recipes: 1) KITCHARI: Equal parts rice and mung dal, cooked with ghee, turmeric, cumin, coriander, ginger, and salt. The universal Ayurvedic healing food — easily digestible, balances all three doshas, provides complete nutrition. 2) GOLDEN MILK: Warm milk with turmeric, black pepper (aids absorption), cinnamon, ginger, and honey (added after cooling below 40°C). Anti-inflammatory, promotes sleep, boosts immunity. 3) CCF TEA: Equal parts cumin, coriander, and fennel seeds steeped in hot water. Aids digestion, reduces bloating, tridoshic (balances all doshas). 4) CHYAWANPRASH: Traditional jam of amla, ghee, sesame oil, and 40+ herbs. Supreme Rasayana (rejuvenator) — 1-2 teaspoons daily for immunity and vitality. 5) TRIPHALA: Equal parts Amalaki, Bibhitaki, Haritaki. Gentle detox, digestive support, eye health. Take before bed with warm water.",
        "metadata": {"source": "AyurSutra Clinical Guidelines", "category": "Diet & Nutrition"}
    },
    # === HERBS & REMEDIES ===
    {
        "id": "herbs-stress",
        "content": "Ayurvedic herbs for stress and mental health: 1) ASHWAGANDHA (Withania somnifera): Premier adaptogen. Reduces cortisol, combats chronic stress, improves sleep quality, enhances strength and stamina. Dose: 300-600mg standardized extract twice daily. Best for Vata and Kapha. 2) BRAHMI (Bacopa monnieri): Brain tonic. Enhances memory, concentration, reduces anxiety, supports neural repair. Dose: 300mg daily. Excellent for students and mental workers. 3) JATAMANSI (Nardostachys jatamansi): Powerful calming herb. Treats insomnia, anxiety, restlessness. Dose: 250-500mg before bed. 4) SHANKHPUSHPI (Convolvulus pluricaulis): Mind rejuvenator. Improves intellect, calms nerves, treats epilepsy. 5) VACHA (Acorus calamus): Improves speech, memory, intelligence. Clears mental toxins. 6) TULSI (Holy Basil): Adaptogen, reduces stress, improves respiratory health, boosts immunity. Take as tea. Caution: Always consult your Ayurvedic practitioner before starting any herbal supplement, especially if taking allopathic medications.",
        "metadata": {"source": "Dravyaguna Vigyan", "category": "Herbs & Remedies"}
    },
    {
        "id": "herbs-digestion",
        "content": "Ayurvedic herbs for digestion: 1) TRIPHALA: The supreme digestive tonic — combination of Amalaki (vitamin C, Pitta), Bibhitaki (astringent, Kapha), Haritaki (purgative, Vata). Gentle overnight cleansing, take 1/2-1 tsp with warm water before bed. 2) TRIKATU: Combination of ginger, black pepper, long pepper (Pippali). Ignites Agni (digestive fire), reduces Ama (toxins). 3) HINGVASTAK CHURNA: Asafoetida-based formula for gas, bloating, and indigestion. 4) AJWAIN (Carom seeds): Immediate relief for gas and bloating — chew 1/2 tsp after meals. 5) GINGER: Fresh ginger slice with salt and lemon before meals stimulates Agni. 6) CUMIN-CORIANDER-FENNEL TEA: Balances all doshas, aids digestion, reduces inflammation. 7) KUTKI: Liver protective, treats hepatitis, improves bile secretion. General rules: Eat only when hungry, don't drink cold water with meals, chew food thoroughly, eat in a calm state.",
        "metadata": {"source": "Dravyaguna Vigyan", "category": "Herbs & Remedies"}
    },
    {
        "id": "herbs-immunity",
        "content": "Ayurvedic herbs for immunity (Vyadhikshamatva): 1) CHYAWANPRASH: The supreme Rasayana. Contains 40+ herbs with Amla as base. 1-2 tsp daily with warm milk. 2) GUDUCHI/GILOY (Tinospora cordifolia): Powerful immunomodulator. Reduces fever, treats autoimmune conditions, liver protective. 3) AMLA (Indian Gooseberry): Richest natural source of vitamin C. Antioxidant, anti-aging, strengthens all tissues. 4) TURMERIC (Haridra): Anti-inflammatory, antioxidant, liver protective. Take with black pepper for bioavailability. 5) NEEM (Nimba): Blood purifier, anti-bacterial, anti-viral, skin healing. 6) TULSI (Holy Basil): Respiratory health, immune boosting, stress relief. 3-5 leaves daily or as tea. 7) MULETHI (Licorice): Respiratory support, throat soothing, adrenal support. Caution with hypertension. Daily immunity routine: warm water with turmeric and pepper on waking, Chyawanprash with breakfast, Tulsi tea midday, Triphala before bed.",
        "metadata": {"source": "Dravyaguna Vigyan", "category": "Herbs & Remedies"}
    },
    # === YOGA & EXERCISE ===
    {
        "id": "yoga-vata",
        "content": "Yoga for Vata constitution: Vata benefits from slow, grounding, steady practices that build stability and calm the nervous system. Recommended asanas: Tadasana (Mountain), Vrikshasana (Tree), Virabhadrasana I & II (Warrior), Paschimottanasana (Seated Forward Bend), Balasana (Child's Pose), Savasana (Corpse — extra long). Pranayama: Nadi Shodhana (Alternate Nostril Breathing) — calming and balancing, Bhramari (Humming Bee Breath). Meditation: Body scan, Yoga Nidra (yogic sleep), mantra chanting (OM, SO-HUM). Practice tips: warm room, slow transitions, hold poses gently without strain, use props, practice at the same time daily, avoid vigorous or rapid sequences. Duration: 30-45 minutes. Best time: early morning or late afternoon. Avoid: hot yoga, rapid sun salutations, excessive jumping, cold environments during practice.",
        "metadata": {"source": "Yoga & Ayurveda Integration", "category": "Yoga & Exercise"}
    },
    {
        "id": "yoga-pitta",
        "content": "Yoga for Pitta constitution: Pitta benefits from cooling, non-competitive, moderately challenging practices that release heat and cultivate compassion. Recommended asanas: all forward bends (cooling), Matsyasana (Fish Pose), Bhujangasana (gentle Cobra), Setu Bandhasana (Bridge), Moon Salutations (Chandra Namaskar), twist sequences. Pranayama: Sheetali (Cooling Breath — inhale through curled tongue), Sheetkari (inhale through teeth), Chandra Bhedana (Left Nostril Breathing). Meditation: Loving-kindness (Metta), water visualization, moonlight meditation. Practice tips: cool/shaded room, avoid midday practice, let go of perfectionism, practice with 75% effort, focus on surrender not achievement. Duration: 45-60 minutes. Best time: early morning or evening. Avoid: Bikram/hot yoga, competitive sports, overexertion, exercising in heat.",
        "metadata": {"source": "Yoga & Ayurveda Integration", "category": "Yoga & Exercise"}
    },
    {
        "id": "yoga-kapha",
        "content": "Yoga for Kapha constitution: Kapha benefits from vigorous, stimulating, dynamic practices that generate heat and movement to counteract heaviness and lethargy. Recommended asanas: Sun Salutations (Surya Namaskar — multiple rounds), Ustrasana (Camel), Dhanurasana (Bow), Navasana (Boat), standing balance poses, backbends, inversions (Shoulderstand, Headstand with practice). Pranayama: Kapalabhati (Skull Shining — rapid exhalations), Bhastrika (Bellows Breath), Ujjayi (Victorious Breath). Meditation: walking meditation, active visualization, dynamic movement meditation. Practice tips: warm or heated room, fast-paced flow, minimal rest between poses, practice even when you don't feel like it, morning practice before breakfast. Duration: 45-75 minutes. Best time: 6-10 AM (Kapha time). Avoid: excessive rest in Savasana, slow restorative classes, practicing after heavy meals.",
        "metadata": {"source": "Yoga & Ayurveda Integration", "category": "Yoga & Exercise"}
    },
    # === DAILY ROUTINE (DINACHARYA) ===
    {
        "id": "dinacharya-morning",
        "content": "Ayurvedic morning routine (Dinacharya): 1) WAKE BEFORE SUNRISE (Brahma Muhurta, ~4:30-6:00 AM) — this is the most sattvic time. 2) ELIMINATION — sit on toilet at regular time to establish habit. 3) ORAL HYGIENE — tongue scraping (Jihwa Prakshalana) with copper/steel scraper (removes Ama), then brush teeth with herbal paste. 4) OIL PULLING (Gandusha) — swish 1 tbsp sesame/coconut oil for 5-15 minutes, spit out. 5) WARM WATER — drink 1-2 glasses of warm/hot water to flush digestive tract. 6) NASYA — 2 drops of Anu Taila or plain sesame oil in each nostril. 7) ABHYANGA (Self-massage) — 10-15 minutes with warm dosha-appropriate oil before shower. 8) BATH — warm water shower after oil massage. 9) YOGA/EXERCISE — 20-45 minutes appropriate to dosha. 10) PRANAYAMA & MEDITATION — 10-20 minutes. 11) BREAKFAST — warm, cooked, appropriate to dosha. Following this routine consistently is one of the most powerful Ayurvedic health practices.",
        "metadata": {"source": "Ashtanga Hridayam", "category": "Daily Routine"}
    },
    {
        "id": "dinacharya-evening",
        "content": "Ayurvedic evening routine: 1) DINNER by 6-7 PM — lightest meal of the day, cooked warm food, no raw/cold. 2) GENTLE WALK — 10-15 minutes after dinner to aid digestion (Shatapavali — 100 steps). 3) MINIMIZE SCREENS — reduce blue light 1+ hours before bed, dim lights. 4) EVENING PRACTICES — light reading of uplifting texts, gentle conversation, journaling, gratitude practice. 5) WARM MILK — golden milk (turmeric milk) or plain warm milk with nutmeg (Jaiphal) and cardamom 30 minutes before bed. 6) FOOT MASSAGE — apply warm sesame or Brahmi oil to soles of feet for 5 minutes (Padabhyanga). 7) NASYA — 2 drops sesame oil in nostrils. 8) SLEEP by 10 PM — sleeping during Kapha time (6-10 PM) promotes deep, restful sleep. The body repairs tissues during sleep; insufficient sleep creates Vata imbalance. Avoid: eating after 8 PM, intense exercise, stimulating content, arguments, caffeine after 2 PM.",
        "metadata": {"source": "Ashtanga Hridayam", "category": "Daily Routine"}
    },
    {
        "id": "seasonal-routine",
        "content": "Ayurvedic seasonal routine (Ritucharya): SPRING (Vasanta, Kapha season): Kapha accumulated in winter melts. Light, dry, warm foods. Vigorous exercise. Dry massage. Avoid heavy, sweet, oily foods. SUMMER (Grishma, Pitta season): Cooling foods, sweet tastes. Reduce exercise intensity. Avoid sun exposure. Coconut water, mint, coriander. Moonlight walks. MONSOON/RAINY (Varsha, Vata season): Warm, cooked, slightly oily foods. Ginger tea. Avoid raw, cold foods. Light exercise. Oil massage. AUTUMN (Sharad, Pitta subsides): Bitter, sweet, astringent tastes. Moderate exercise. Ghee-based foods. WINTER (Hemanta/Shishira, Kapha builds): Nourishing, heavy, warming foods. Vigorous exercise. Sesame oil massage. Sweet, sour, salty tastes. This cyclical approach ensures balance throughout the year and prevents seasonal diseases.",
        "metadata": {"source": "Classical Ayurveda", "category": "Daily Routine"}
    },
    # === PRE & POST TREATMENT ===
    {
        "id": "pre-treatment-general",
        "content": "General pre-treatment guidelines for Panchakarma sessions at AyurSutra: 1) FASTING: Light meal 2-3 hours before appointment. Avoid heavy, fried, non-vegetarian food day of treatment. 2) HYDRATION: Drink warm water throughout the day. Avoid cold beverages. 3) CLOTHING: Wear loose, comfortable, old clothes you don't mind getting oily. 4) MENTAL PREPARATION: Practice deep breathing for 5 minutes before arriving. Set a healing intention. Release expectations. 5) ARRIVE EARLY: 15 minutes before scheduled time for check-in and settling. 6) COMMUNICATE: Inform practitioner of any new symptoms, medication changes, or concerns. 7) AVOID: Alcohol 24+ hours before, heavy exercise day of treatment, caffeine morning of treatment, cold food/drinks. 8) BRING: Water bottle (warm/room temp), light change of clothes, hair tie. 9) SCHEDULE: Plan rest after session — avoid work meetings or strenuous activity. The more prepared you are, the more effective your treatment.",
        "metadata": {"source": "AyurSutra Patient Handbook", "category": "Treatment Preparation"}
    },
    {
        "id": "post-treatment-general",
        "content": "General post-treatment care after Panchakarma sessions: 1) REST: Minimum 30-60 minutes of quiet rest immediately after. Plan a restful remainder of the day. 2) HYDRATION: Sip warm water or herbal tea (ginger, tulsi, CCF). No cold/iced drinks for 24 hours. 3) DIET: Light, warm, easily digestible food. Kitchari or clear vegetable soup ideal. Avoid heavy, raw, cold, fried, spicy foods for 24 hours. 4) BATHING: Warm water only. Wait 2+ hours after oil treatments. Gentle, natural soap. 5) ACTIVITY: Gentle walking acceptable. No gym, running, swimming for 24 hours. 6) ENVIRONMENT: Stay warm. Avoid drafts, AC, cold wind. 7) SLEEP: Early bedtime. Extra rest if feeling fatigued (normal response). 8) EMOTIONAL: Treatment may release stored emotions. Allow feelings without judgment. Journal if helpful. 9) OBSERVE: Note any changes in digestion, sleep, energy, mood — share with practitioner. 10) FOLLOW-UP: Take prescribed herbs, follow diet plan, maintain routine. Healing happens in the hours/days AFTER treatment.",
        "metadata": {"source": "AyurSutra Patient Handbook", "category": "Treatment Preparation"}
    },
    # === WELLNESS & LIFESTYLE ===
    {
        "id": "stress-management",
        "content": "Ayurvedic stress management techniques: PHYSICAL: Abhyanga (self-oil massage) with warm sesame oil — 15 minutes daily reduces cortisol by up to 30%. Warm baths with Epsom salts and lavender. Regular gentle exercise (walking, yoga, swimming). BREATHING (Pranayama): 4-7-8 technique (inhale 4 counts, hold 7, exhale 8). Nadi Shodhana (alternate nostril breathing) — balances left/right brain. Bhramari (humming bee breath) — activates parasympathetic nervous system. HERBAL SUPPORT: Ashwagandha (300-600mg), Brahmi (300mg), Tulsi tea, Jatamansi before bed. DIET: Warm, cooked, grounding foods. Avoid caffeine, sugar, alcohol. Eat at regular times. MENTAL: Daily meditation (10-20 minutes). Journaling. Gratitude practice. Digital detox. Time in nature. Creative expression. SLEEP: 10 PM bedtime. Warm milk with nutmeg. Foot massage with oil. No screens 1 hour before bed. Consistent sleep schedule. SOCIAL: Meaningful connections. Limit negative media. Satsang (spiritual community).",
        "metadata": {"source": "AyurSutra Wellness Program", "category": "Wellness"}
    },
    {
        "id": "sleep-ayurveda",
        "content": "Ayurvedic approach to sleep (Nidra): Sleep is one of the three pillars of health (Trayopastambha) along with food and lifestyle. IDEAL SCHEDULE: Sleep 10 PM - 6 AM (aligns with natural dosha cycles). VATA SLEEP ISSUES: Difficulty falling asleep, light sleep, waking 2-4 AM. Solution: warm oil foot massage, warm milk with nutmeg, Ashwagandha, heavy blankets, consistent schedule. PITTA SLEEP ISSUES: Difficulty falling asleep due to active mind, intense dreams. Solution: cooling room, moonlight exposure before bed, Brahmi, avoid stimulating activity after 8 PM, journal before bed. KAPHA SLEEP ISSUES: Excessive sleep, difficulty waking, feel unrefreshed. Solution: lighter dinner, earlier bedtime, wake before sunrise, vigorous morning exercise, avoid daytime naps. GENERAL: Sleep on left side (aids digestion). Apply oil to scalp and soles of feet. Sleep in complete darkness. No eating 2+ hours before bed. Avoid daytime sleep (increases Kapha) except brief nap in summer.",
        "metadata": {"source": "Charaka Samhita", "category": "Wellness"}
    },
    {
        "id": "detox-lifestyle",
        "content": "Ayurvedic daily detox practices (Ama Pachana): AMA (toxins) accumulates from improper digestion, lifestyle, and environmental factors. Signs of Ama: white coating on tongue, bad breath, sluggish digestion, body aches, brain fog, lethargy, joint stiffness. DAILY DETOX PRACTICES: 1) Tongue scraping every morning (7-14 strokes). 2) Warm lemon water on waking. 3) CCF tea (cumin-coriander-fennel) between meals. 4) Triphala before bed (1/2 tsp in warm water). 5) Dry brushing before shower (Garshana). 6) Regular meal times with largest meal at lunch. 7) No snacking — allow 3-4 hours between meals for complete digestion. 8) Weekly kitchari cleanse (eat only kitchari for one day). 9) Seasonal Panchakarma (ideally at season transitions). 10) Regular exercise appropriate to constitution. KEY PRINCIPLE: Strong Agni (digestive fire) prevents Ama formation. Protect your Agni by eating fresh food, avoiding overeating, eating in a calm state, and never eating when not hungry.",
        "metadata": {"source": "AyurSutra Wellness Program", "category": "Wellness"}
    },
    # === CONTRAINDICATIONS & SAFETY ===
    {
        "id": "contraindications",
        "content": "Important contraindications and safety information for Panchakarma: GENERAL CONTRAINDICATIONS: Pregnancy, active menstruation, acute fever, severe debility, children under 12 (modified protocols), extreme old age, active bleeding, uncontrolled diabetes, severe heart disease, active cancer (consult oncologist). SPECIFIC THERAPY CONTRAINDICATIONS: Vamana — avoid with heart disease, hemorrhage, Vata disorders, weakness. Virechana — avoid with rectal prolapse, active diarrhea, bleeding disorders. Basti — avoid with rectal bleeding, extreme weakness, diarrhea. Nasya — avoid after meals, bathing, with nasal injuries. Shirodhara — avoid with neck injury, brain tumor, full stomach. Swedana — avoid with hypertension, excess Pitta, skin infections, dehydration. IMPORTANT: Always disclose ALL medications (allopathic, homeopathic, supplements) to your practitioner. Some Ayurvedic herbs interact with pharmaceutical medications. Never discontinue prescribed medications without consulting your physician. Ayurveda complements but does not replace modern medical care for acute conditions.",
        "metadata": {"source": "AyurSutra Clinical Safety Protocol", "category": "Safety"}
    },
    # === AYURSUTRA SPECIFIC ===
    {
        "id": "ayursutra-about",
        "content": "AyurSutra is a comprehensive Panchakarma Patient Management System designed to support your healing journey. Features for patients: View and manage therapy sessions, track treatment progress with real-time health metrics, access personalized diet and yoga recommendations based on your dosha, communicate with your practitioner, receive preparation reminders and post-treatment care instructions, submit session feedback to help optimize your treatment plan, access educational resources about Ayurvedic therapies and lifestyle. Our AI-powered AyurBot provides 24/7 guidance on diet, lifestyle, pre/post treatment care, and general Ayurvedic wellness questions. All information provided is based on classical Ayurvedic texts and our clinical guidelines. For personalized medical advice, always consult your assigned practitioner. AyurSutra is committed to making authentic Panchakarma accessible, trackable, and effective for every patient.",
        "metadata": {"source": "AyurSutra Platform", "category": "About AyurSutra"}
    },
    {
        "id": "ayursutra-booking",
        "content": "How to manage your sessions at AyurSutra: BOOKING: Navigate to 'My Sessions' from the sidebar to view all your scheduled and past sessions. Your practitioner will typically schedule sessions as part of your treatment plan. PREPARATION: Each session card shows specific preparation instructions. Follow them carefully for maximum benefit. RESCHEDULING: Click 'Reschedule' on any upcoming session card. Please provide at least 24 hours notice. CANCELLATION: You may cancel upcoming sessions. Frequent cancellations may affect treatment continuity. FEEDBACK: After each session, submit feedback about your experience, energy levels, and mood. This helps your practitioner optimize your treatment plan. TRACKING: Visit 'Progress' to see your treatment journey — including health metrics, session completion percentage, and wellness trends. COMMUNICATION: Use the messaging feature to communicate with your practitioner between sessions for any questions or concerns.",
        "metadata": {"source": "AyurSutra Platform", "category": "About AyurSutra"}
    }
]

# --- TF-IDF RAG Retrieval Engine ---
class TFIDFRetriever:
    """Simple but effective TF-IDF based document retriever for RAG"""
    
    def __init__(self, documents: List[Dict]):
        self.documents = documents
        self.stop_words = {
            'the', 'a', 'an', 'is', 'in', 'on', 'of', 'for', 'to', 'and', 
            'with', 'was', 'are', 'it', 'its', 'by', 'at', 'or', 'be', 'as',
            'this', 'that', 'from', 'they', 'their', 'can', 'will', 'has',
            'have', 'do', 'does', 'not', 'but', 'all', 'you', 'your', 'we',
            'our', 'what', 'which', 'who', 'when', 'where', 'how', 'may',
            'should', 'would', 'could', 'also', 'than', 'then', 'these',
            'those', 'each', 'other', 'some', 'such', 'more', 'most', 'very',
            'just', 'about', 'after', 'before', 'between', 'into', 'through',
            'during', 'without', 'again', 'been', 'being', 'both', 'here',
            'there', 'them', 'only', 'over', 'under'
        }
        self._build_index()
    
    def _tokenize(self, text: str) -> List[str]:
        """Tokenize and normalize text"""
        tokens = re.findall(r'\b[a-z]+\b', text.lower())
        return [t for t in tokens if t not in self.stop_words and len(t) > 2]
    
    def _build_index(self):
        """Build TF-IDF index"""
        self.doc_tokens = []
        self.df = Counter()  # document frequency
        
        for doc in self.documents:
            tokens = self._tokenize(doc["content"])
            self.doc_tokens.append(tokens)
            unique_tokens = set(tokens)
            for token in unique_tokens:
                self.df[token] += 1
        
        self.num_docs = len(self.documents)
    
    def _compute_tfidf(self, tokens: List[str]) -> Dict[str, float]:
        """Compute TF-IDF vector for a token list"""
        tf = Counter(tokens)
        total = len(tokens) if tokens else 1
        tfidf = {}
        for token, count in tf.items():
            tf_val = count / total
            idf_val = math.log((self.num_docs + 1) / (self.df.get(token, 0) + 1)) + 1
            tfidf[token] = tf_val * idf_val
        return tfidf
    
    def _cosine_similarity(self, vec1: Dict[str, float], vec2: Dict[str, float]) -> float:
        """Compute cosine similarity between two sparse vectors"""
        common_keys = set(vec1.keys()) & set(vec2.keys())
        if not common_keys:
            return 0.0
        
        dot_product = sum(vec1[k] * vec2[k] for k in common_keys)
        mag1 = math.sqrt(sum(v ** 2 for v in vec1.values()))
        mag2 = math.sqrt(sum(v ** 2 for v in vec2.values()))
        
        if mag1 == 0 or mag2 == 0:
            return 0.0
        return dot_product / (mag1 * mag2)
    
    def retrieve(self, query: str, top_k: int = 4) -> List[Dict]:
        """Retrieve top-k most relevant documents for a query"""
        query_tokens = self._tokenize(query)
        if not query_tokens:
            return self.documents[:top_k]
        
        query_tfidf = self._compute_tfidf(query_tokens)
        
        scored = []
        for i, doc in enumerate(self.documents):
            doc_tfidf = self._compute_tfidf(self.doc_tokens[i])
            similarity = self._cosine_similarity(query_tfidf, doc_tfidf)
            scored.append((similarity, doc))
        
        scored.sort(reverse=True, key=lambda x: x[0])
        
        # Return top_k documents with non-zero similarity, or fallback to top_k overall
        relevant = [doc for score, doc in scored[:top_k] if score > 0.01]
        if not relevant:
            return [doc for _, doc in scored[:top_k]]
        return relevant

# Initialize the retriever
retriever = TFIDFRetriever(AYURVEDIC_KNOWLEDGE)

# --- Core AI Generation using Mistral ---
def generate_ai_response(
    query: str, 
    relevant_knowledge: List[Dict], 
    conversation_history: Optional[List[Dict[str, str]]] = None,
    patient_context: Optional[PatientContext] = None
) -> Dict[str, str]:
    if not client:
        return {
            "plain_text": "I'm sorry, the AI service is currently unavailable. Please try again later.",
            "formatted_html": None
        }

    # Build system prompt with patient context
    system_prompt = """You are AyurBot, an expert Ayurvedic wellness assistant for AyurSutra — a Panchakarma Patient Management System. 

Your role:
- Provide accurate, helpful guidance based on classical Ayurvedic texts and the provided knowledge context
- Give practical, actionable advice on diet, lifestyle, yoga, herbs, and treatment preparation
- Be warm, compassionate, and encouraging
- Always mention when professional medical advice is needed for serious conditions
- Structure your responses clearly with headers, bullet points, and emphasis where helpful
- Keep responses concise but thorough (200-400 words)

Important guidelines:
- Never diagnose medical conditions
- Never recommend stopping prescribed medications
- Always defer to the patient's assigned practitioner for personalized medical decisions
- Clearly state when something is general guidance vs personalized advice
- Use emoji sparingly but appropriately for warmth (🌿, 🧘, ✨, 💡)"""

    if patient_context:
        context_parts = []
        if patient_context.name:
            context_parts.append(f"Patient Name: {patient_context.name}")
        if patient_context.dosha:
            context_parts.append(f"Dosha Constitution: {patient_context.dosha}")
        if patient_context.current_therapy:
            context_parts.append(f"Current Therapy: {patient_context.current_therapy}")
        if patient_context.treatment_day and patient_context.total_treatment_days:
            context_parts.append(f"Treatment Progress: Day {patient_context.treatment_day} of {patient_context.total_treatment_days}")
        if patient_context.medical_history:
            context_parts.append(f"Medical History: {patient_context.medical_history}")
        
        if context_parts:
            system_prompt += f"\n\nPatient Context:\n" + "\n".join(context_parts)
            system_prompt += "\n\nPersonalize your responses based on this patient's context when relevant."

    messages = [{"role": "system", "content": system_prompt}]
    
    # Add conversation history (sliding window of last 10 messages)
    if conversation_history:
        for msg in conversation_history[-10:]:
            role = "assistant" if msg.get("role") in ("model", "assistant") else "user"
            messages.append({"role": role, "content": msg.get("content", "")})
    
    # Build RAG context from retrieved documents
    context_parts = []
    for k in relevant_knowledge:
        source = k['metadata'].get('source', 'Ayurvedic Knowledge')
        category = k['metadata'].get('category', 'General')
        context_parts.append(f"[{category} — {source}]\n{k['content']}")
    
    context_text = "\n\n---\n\n".join(context_parts)
    
    user_message = f"""Based on the following Ayurvedic knowledge context, answer the patient's question.

KNOWLEDGE CONTEXT:
{context_text}

PATIENT'S QUESTION: {query}

Provide a helpful, structured response. If the context doesn't fully cover the question, use your Ayurvedic expertise but note it's general guidance."""

    messages.append({"role": "user", "content": user_message})

    try:
        resp = client.chat.completions.create(
            model="mistral-small-latest",
            messages=messages,
            temperature=0.5,
            max_tokens=800
        )
        text = resp.choices[0].message.content.strip()
        return {"plain_text": text, "formatted_html": None}
    except Exception as e:
        print(f"[ERROR] AI generation failed: {e}")
        fallback = "I'm sorry, I couldn't process your request right now. Please try again in a moment, or contact your practitioner for immediate assistance."
        return {"plain_text": fallback, "formatted_html": None}


# --- API Routes ---
@router.post("/chat", response_model=ChatResponse)
async def chat_with_ayurbot(request: ChatRequest, token: dict = Depends(verify_firebase_token)):
    if not client:
        raise HTTPException(status_code=503, detail="AI service unavailable. API key not configured.")
    
    # RAG: Retrieve relevant knowledge
    relevant = retriever.retrieve(request.message, top_k=4)
    
    # Generate AI response with context
    ai_resp = generate_ai_response(
        request.message, 
        relevant, 
        request.conversation_history,
        request.patient_context
    )
    
    # Extract unique sources
    sources = list({entry["metadata"]["source"] for entry in relevant})
    source_categories = list({entry["metadata"]["category"] for entry in relevant})
    
    return ChatResponse(
        response=ai_resp["plain_text"],
        sources=sources,
        source_categories=source_categories,
        formatted_html=ai_resp.get("formatted_html"),
        plain_text=ai_resp["plain_text"]
    )


@router.get("/health")
async def chatbot_health():
    return {
        "status": "healthy",
        "knowledge_base_entries": len(AYURVEDIC_KNOWLEDGE),
        "api_key_configured": bool(client),
        "retrieval_method": "TF-IDF"
    }


@router.get("/knowledge")
async def list_knowledge_topics(token: dict = Depends(verify_firebase_token)):
    """List available knowledge base topics and categories"""
    categories = {}
    for entry in AYURVEDIC_KNOWLEDGE:
        cat = entry["metadata"]["category"]
        if cat not in categories:
            categories[cat] = []
        categories[cat].append({
            "id": entry["id"],
            "source": entry["metadata"]["source"],
            "preview": entry["content"][:120] + "..."
        })
    return {
        "total_documents": len(AYURVEDIC_KNOWLEDGE),
        "categories": categories
    }
