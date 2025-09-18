import React from 'react'
import { createRoot } from 'react-dom/client'

function App(){
  const [offers, setOffers] = React.useState([])
  const api = import.meta.env.VITE_API_URL || '/api'
  React.useEffect(()=>{
    fetch(`${api}/offers`).then(r=>r.json()).then(d=>setOffers(d.items||[]))
  },[])
  return (
    <div style={{fontFamily:'Inter, system-ui, sans-serif', padding:16}}>
      <h1>P2P NFT-swap (TON) — MVP</h1>
      <p>TonConnect mock, Mini App каркас. API: <code>{api}</code></p>
      <form onSubmit={async (e)=>{
        e.preventDefault();
        const body = {
          maker: 'test-maker',
          offeredKind: 'NFT',
          wantedKind: 'TON',
          feeBps: 200
        };
        await fetch(`${api}/offers`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
        const d = await fetch(`${api}/offers`).then(r=>r.json());
        setOffers(d.items||[]);
      }}>
        <button type="submit">Создать тестовый оффер</button>
      </form>
      <ul>
        {offers.map(o=>(
          <li key={String(o.id)}>
            #{String(o.id)} — {o.offeredKind} → {o.wantedKind} — status: {o.status}
          </li>
        ))}
      </ul>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App/>)
