import React from 'react'
import { createRoot } from 'react-dom/client'

function App(){
  const [offers, setOffers] = React.useState([])
  const [err, setErr] = React.useState('')
  const api = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api';


  async function refresh(){
    try {
      const r = await fetch(`${api}/offers`)
      if(!r.ok) throw new Error(`GET /offers -> ${r.status}`)
      const d = await r.json()
      setOffers(Array.isArray(d.items) ? d.items : [])
    } catch (e) {
      setErr(String(e))
      console.error(e)
    }
  }

  async function createOffer(){
    try {
      const body = { maker: 'test-maker', offeredKind: 'NFT', wantedKind: 'TON', feeBps: 200 }
      const r = await fetch(`${api}/offers`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(body)
      })
      if(!r.ok) throw new Error(`POST /offers -> ${r.status}`)
      await refresh()
    } catch (e) {
      setErr(String(e))
      console.error(e)
      alert('Ошибка создания оффера: ' + String(e))
    }
  }

  async function openTonkeeper(endpoint){
    try {
      const r = await fetch(`${api}${endpoint}`)
      if(!r.ok) throw new Error(`${endpoint} -> ${r.status}`)
      const data = await r.json()
      const payload = encodeURIComponent(JSON.stringify(data))
      const link = `https://app.tonkeeper.com/ton-connect?v=2&request=${payload}`
      window.open(link, '_blank')
    } catch (e) {
      setErr(String(e))
      console.error(e)
      alert('TonConnect payload error: ' + String(e))
    }
  }

  React.useEffect(()=>{ refresh() },[])

  return (
    <div style={{fontFamily:'Inter, system-ui, sans-serif', padding:16, lineHeight:1.4}}>
      <h1>P2P NFT-swap (TON) — MVP</h1>
      <p>API: <code>{api}</code></p>

      <div style={{display:'flex', gap:8, flexWrap:'wrap', margin:'12px 0'}}>
        <button onClick={()=>openTonkeeper('/tonconnect/deposit-demo')}>Deposit (demo)</button>
        <button onClick={()=>openTonkeeper('/tonconnect/execute-demo')}>Execute (demo)</button>
        <button onClick={()=>openTonkeeper('/tonconnect/setfee-demo')}>Set Fee (demo)</button>
        <button onClick={createOffer}>Создать тестовый оффер</button>
      </div>

      {err && <div style={{color:'crimson', marginBottom:12}}>Ошибка: {err}</div>}

      <ul>
        {offers.map(o=>(
          <li key={String(o.id)}>
            #{String(o.id)} — {o.offeredKind} → {o.wantedKind} — status: {o.status ?? 'new'}
          </li>
        ))}
      </ul>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
