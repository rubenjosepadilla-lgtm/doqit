import { createHash } from 'crypto'

// Minimal RFC 3161 TimeStampReq builder (DER encoding)
// Uses SHA-256 hash of the data, nonce for uniqueness
function buildTsq(dataHash: Buffer): Buffer {
  // SHA-256 OID: 2.16.840.1.101.3.4.2.1
  const sha256OidBytes = Buffer.from([0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01])

  // AlgorithmIdentifier ::= SEQUENCE { algorithm OID, parameters NULL }
  const nullBytes = Buffer.from([0x05, 0x00])
  const oidTlv = Buffer.concat([Buffer.from([0x06, sha256OidBytes.length]), sha256OidBytes])
  const algId = tlv(0x30, Buffer.concat([oidTlv, nullBytes]))

  // MessageImprint ::= SEQUENCE { hashAlgorithm AlgorithmIdentifier, hashedMessage OCTET STRING }
  const hashOctet = tlv(0x04, dataHash)
  const msgImprint = tlv(0x30, Buffer.concat([algId, hashOctet]))

  // Nonce: random 8 bytes as INTEGER
  const nonceBytes = Buffer.from(Array.from({ length: 8 }, () => Math.floor(Math.random() * 256)))
  // Ensure positive integer (clear high bit)
  nonceBytes[0] = nonceBytes[0] & 0x7f
  const nonce = tlv(0x02, nonceBytes)

  // version INTEGER (1)
  const version = Buffer.from([0x02, 0x01, 0x01])

  // certReq BOOLEAN TRUE
  const certReq = Buffer.from([0x01, 0x01, 0xff])

  // TimeStampReq ::= SEQUENCE { version, messageImprint, nonce, certReq }
  const tsq = tlv(0x30, Buffer.concat([version, msgImprint, nonce, certReq]))
  return tsq
}

function tlv(tag: number, value: Buffer): Buffer {
  const len = value.length
  let lenBytes: Buffer
  if (len < 128) {
    lenBytes = Buffer.from([len])
  } else if (len < 256) {
    lenBytes = Buffer.from([0x81, len])
  } else {
    lenBytes = Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff])
  }
  return Buffer.concat([Buffer.from([tag]), lenBytes, value])
}

export async function stampWithFreeTsa(dataHash: string): Promise<{ tsaTimestamp: string; tsaTokenB64: string } | null> {
  try {
    const hashBuffer = Buffer.from(dataHash, 'hex')
    const tsqDer = buildTsq(hashBuffer)

    const res = await fetch('https://freetsa.org/tsr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/timestamp-query' },
      body: tsqDer,
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) return null

    const tsrBytes = Buffer.from(await res.arrayBuffer())
    const tsaTokenB64 = tsrBytes.toString('base64')

    // Extract timestamp from response — use current time as approximation
    // (Proper ASN.1 parsing of TSR is complex; TSA-stamped time is in the token)
    const tsaTimestamp = new Date().toISOString()

    return { tsaTimestamp, tsaTokenB64 }
  } catch {
    return null
  }
}
