
const out = id => document.getElementById('output');

function show(obj){
  try { out('output').textContent = JSON.stringify(obj, null, 2); }
  catch(e){ out('output').textContent = String(obj); }
}

// GET /internal
document.getElementById('btn-internal').addEventListener('click', async ()=>{
  const r = await fetch('/internal');
  show(await r.json());
});

// GET /internal-async
document.getElementById('btn-internal-async').addEventListener('click', async ()=>{
  const r = await fetch('/internal-async');
  show(await r.json());
});

// GET /external
document.getElementById('btn-external').addEventListener('click', async ()=>{
  const url = encodeURIComponent(document.getElementById('external-url').value);
  const r = await fetch(`/external?url=${url}`);
  show(await r.json());
});

// File input load
document.getElementById('file-input').addEventListener('change', async (e)=>{
  const f = e.target.files[0];
  if (!f) return;
  const text = await f.text();
  document.getElementById('payload').value = text;
});

// POST /receive
document.getElementById('btn-send').addEventListener('click', async ()=>{
  let txt = document.getElementById('payload').value;
  try {
    const parsed = JSON.parse(txt);
    const r = await fetch('/receive', {
      method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(parsed)
    });
    show(await r.json());
  } catch (err) {
    show({ error: 'JSON inválido en el textarea', details: err.message });
  }
});
