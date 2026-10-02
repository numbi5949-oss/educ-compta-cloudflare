import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';

const app = new Hono();

// Route test
app.get('/', (c) => c.json({ ok: true, message: 'EDUC-COMPTA API Cloudflare OK' }));

// 1. RELANCE SOLDE PERSONNALISEE - avec ton template relance_solde_v2
// Template : Bonjour {{prenom}}, formation {{formation}}, Montant {{montant}}
app.post('/api/relance-solde', async (c) => {
  const { WHATSAPP_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PHONE_NUMBER_ID } = c.env;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const TEMPLATE_NAME = "relance_solde_v2";

  const { data: clients } = await supabase
   .from('inscriptions')
   .select(`phone, prenom, nom, solde_restant, formations ( nom_formation )`)
   .gt('solde_restant', 0);

  let envoye = 0;
  for (const client of clients) {
    if (!client.phone) continue;
    const numeroClean = client.phone.replace(/[^0-9]/g, '');
    const prenom = `${client.prenom || ''}`.trim() || "cher(e) apprenant(e)";
    const formation = client.formations?.nom_formation || "votre formation";
    const montant = `${client.solde_restant} USD`;

    await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: numeroClean,
        type: 'template',
        template: {
          name: TEMPLATE_NAME,
          language: { code: 'fr' },
          components: [{
            type: 'body',
            parameters: [
              { type: 'text', text: prenom, parameter_name: 'prenom' },
              { type: 'text', text: formation, parameter_name: 'formation' },
              { type: 'text', text: montant, parameter_name: 'montant' }
            ]
          }]
        }
      })
    });
    envoye++;
    await new Promise(r => setTimeout(r, 400));
  }
  return c.json({ ok: true, envoye });
});

// 2. COMMUNIQUES DIVERS - avec ton template communique_educ_v2
app.post('/api/communique', async (c) => {
  const { WHATSAPP_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PHONE_NUMBER_ID } = c.env;
  const { objet, message, infos } = await c.req.json(); // Tu envoies ces 3 infos depuis ton site

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const TEMPLATE_NAME = "communique_educ_v2";

  const { data: clients } = await supabase.from('inscriptions').select('phone, prenom, nom');

  for (const client of clients) {
    if (!client.phone) continue;
    const numeroClean = client.phone.replace(/[^0-9]/g, '');
    const prenom = `${client.prenom || ''}`.trim() || "cher(e) apprenant(e)";

    await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: numeroClean,
        type: 'template',
        template: {
          name: TEMPLATE_NAME,
          language: { code: 'fr' },
          components: [{
            type: 'body',
            parameters: [
              { type: 'text', text: prenom, parameter_name: 'prenom' },
              { type: 'text', text: objet, parameter_name: 'objet' },
              { type: 'text', text: message, parameter_name: 'message' },
              { type: 'text', text: infos, parameter_name: 'infos' }
            ]
          }]
        }
      })
    });
    await new Promise(r => setTimeout(r, 400));
  }
  return c.json({ ok: true, envoye: clients.length });
});

export default app;
