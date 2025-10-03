'use client'
import { useEffect, useState } from 'react'

export default function HydrateTest() {
  const [n, setN] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setN(x => x + 1), 500)
    return () => clearInterval(id)
  }, [])
  return (
    <div style={{height:'100vh',display:'grid',placeItems:'center',fontFamily:'monospace'}}>
      <div>
        <h1>Hydration Counter</h1>
        <p>n = {n}</p>
      </div>
    </div>
  )
}
