import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { faker } from '@faker-js/faker'
import { subDays, subMonths, subYears } from 'date-fns'

const prisma = new PrismaClient()

// ── Indian names ─────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Rahul', 'Priya', 'Amit', 'Sneha', 'Vijay', 'Kavya', 'Rohan', 'Pooja',
  'Arjun', 'Deepika', 'Karan', 'Ananya', 'Siddharth', 'Ishaan', 'Meera',
  'Aditya', 'Nisha', 'Vikram', 'Shreya', 'Nikhil', 'Divya', 'Rajesh',
  'Sunita', 'Manish', 'Rekha', 'Sanjay', 'Lakshmi', 'Suresh', 'Geeta',
  'Naveen', 'Swati', 'Harish', 'Pallavi', 'Ramesh', 'Usha', 'Girish',
  'Smita', 'Mahesh', 'Ritu', 'Pankaj', 'Anjali', 'Dinesh', 'Varsha',
  'Vikas', 'Shweta', 'Ajay', 'Neha', 'Ravi', 'Seema', 'Ashok',
]

const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Joshi', 'Rao',
  'Mehta', 'Nair', 'Iyer', 'Reddy', 'Malhotra', 'Kapoor', 'Bose', 'Das',
  'Pillai', 'Naik', 'Jain', 'Shah', 'Trivedi', 'Pandey', 'Mishra', 'Tiwari',
  'Chaudhary', 'Yadav', 'Agarwal', 'Banerjee', 'Chatterjee', 'Mukherjee',
  'Srivastava', 'Dubey', 'Shukla', 'Saxena', 'Chauhan', 'Bhatt', 'Dixit',
  'Sinha', 'Thakur', 'Naidu', 'Menon', 'Kaur', 'Gill', 'Chopra', 'Bhatia',
  'Mahajan', 'Sethi', 'Arora', 'Kohli', 'Anand',
]

// Weighted city distribution
const CITIES = [
  ...Array(20).fill('Mumbai'),
  ...Array(18).fill('Delhi'),
  ...Array(15).fill('Bengaluru'),
  ...Array(10).fill('Hyderabad'),
  ...Array(10).fill('Pune'),
  ...Array(8).fill('Chennai'),
  ...Array(7).fill('Kolkata'),
  ...Array(5).fill('Ahmedabad'),
  ...Array(4).fill('Jaipur'),
  ...Array(3).fill('Surat'),
]

const EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com']
const ORDER_ITEMS   = [
  'Kurta', 'Lehenga', 'Saree', 'Jeans', 'Top', 'Sneakers',
  'Sandals', 'Dupatta', 'Jacket', 'Dress',
]

// ── Weighted random number ────────────────────────────────────────────────────

function weightedSpend(): number {
  const r = Math.random()
  if (r < 0.60) return faker.number.float({ min: 500,   max: 5000,  fractionDigits: 0 })
  if (r < 0.90) return faker.number.float({ min: 5000,  max: 20000, fractionDigits: 0 })
  return faker.number.float({ min: 20000, max: 85000, fractionDigits: 0 })
}

function derivedOrderCount(spend: number): number {
  if (spend < 5000)  return faker.number.int({ min: 1, max: 5 })
  if (spend < 20000) return faker.number.int({ min: 3, max: 15 })
  return faker.number.int({ min: 8, max: 40 })
}

// ── Main seed function ────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting seed...')

  // ── Clean existing data ───────────────────────────────────────────────────
  await prisma.campaignRecipient.deleteMany()
  await prisma.campaign.deleteMany()
  await prisma.segment.deleteMany()
  await prisma.order.deleteMany()
  await prisma.customer.deleteMany()
  console.log('✅ Cleared existing data')

  // ── Generate 500 customers ────────────────────────────────────────────────
  const customers = []
  const now = new Date()

  for (let i = 0; i < 500; i++) {
    const firstName   = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
    const lastName    = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
    const totalSpend  = weightedSpend()
    const orderCount  = derivedOrderCount(totalSpend)
    const lastOrderAt = faker.date.between({ from: subDays(now, 180), to: subDays(now, 1) })
    const firstOrderAt = faker.date.between({
      from: subYears(now, 3),
      to:   subMonths(now, 6),
    })

    const tags: string[] = []
    if (orderCount > 10)                                    tags.push('loyal')
    if (totalSpend > 20000)                                 tags.push('vip')
    if (lastOrderAt < subDays(now, 60))                    tags.push('lapsed')
    if (firstOrderAt > subDays(now, 30))                   tags.push('new')

    customers.push({
      firstName,
      lastName,
      email:       `${firstName.toLowerCase()}.${lastName.toLowerCase()}${faker.string.numeric(3)}@${faker.helpers.arrayElement(EMAIL_DOMAINS)}`,
      phone:       `+91${faker.string.numeric(10)}`,
      city:        CITIES[Math.floor(Math.random() * CITIES.length)],
      totalSpend,
      orderCount,
      lastOrderAt,
      firstOrderAt,
      tags,
    })
  }

  // Batch-insert customers in chunks
  const CHUNK = 50
  const insertedCustomers: { id: string; totalSpend: number; orderCount: number; lastOrderAt: Date | null; firstOrderAt: Date | null }[] = []

  for (let i = 0; i < customers.length; i += CHUNK) {
    const chunk = customers.slice(i, i + CHUNK)
    for (const c of chunk) {
      const created = await prisma.customer.create({ data: c })
      insertedCustomers.push(created)
    }
    process.stdout.write(`\r  Customers: ${Math.min(i + CHUNK, 500)}/500`)
  }
  console.log('\n✅ 500 customers inserted')

  // ── Generate 3-10 orders per customer ────────────────────────────────────
  let orderCount = 0
  for (const customer of insertedCustomers) {
    const count = faker.number.int({ min: 3, max: 10 })
    const orders = []
    const baseDate = customer.firstOrderAt ?? subYears(now, 2)

    for (let j = 0; j < count; j++) {
      const items = faker.helpers.arrayElements(ORDER_ITEMS, faker.number.int({ min: 1, max: 4 }))
      const r = Math.random()
      orders.push({
        customerId:  customer.id,
        orderNumber: `ORD-${faker.string.alphanumeric(8).toUpperCase()}`,
        amount:      faker.number.float({ min: 300, max: 8000, fractionDigits: 0 }),
        status:      r < 0.93 ? 'completed' : r < 0.98 ? 'returned' : 'cancelled',
        channel:     faker.helpers.arrayElement(['online', 'store', 'app']),
        items:       items,
        orderedAt:   faker.date.between({ from: baseDate, to: customer.lastOrderAt ?? now }),
      })
    }

    await prisma.order.createMany({ data: orders, skipDuplicates: true })
    orderCount += orders.length

    const calculatedSpend = orders.reduce((sum, o) => sum + o.amount, 0)
    await prisma.customer.update({
      where: { id: customer.id },
      data: { orderCount: orders.length, totalSpend: calculatedSpend }
    })
  }
  console.log(`✅ ${orderCount} orders inserted`)

  // ── 5 pre-built segments ──────────────────────────────────────────────────
  const segments = await Promise.all([
    prisma.segment.create({
      data: {
        name:        'High Value Customers',
        description: 'Customers who have spent ₹10,000 or more',
        rules: {
          operator: 'AND',
          conditions: [{ field: 'totalSpend', operator: 'gte', value: 10000 }],
        },
        count: await prisma.customer.count({ where: { totalSpend: { gte: 10000 } } }),
      },
    }),
    prisma.segment.create({
      data: {
        name:        'Lapsed (60+ Days)',
        description: "Customers who haven't ordered in the last 60 days",
        rules: {
          operator: 'AND',
          conditions: [{ field: 'lastOrderAt', operator: 'notOrderedInDays', value: 60 }],
        },
        count: await prisma.customer.count({
          where: { OR: [{ lastOrderAt: { lt: subDays(now, 60) } }, { lastOrderAt: null }] },
        }),
      },
    }),
    prisma.segment.create({
      data: {
        name:        'New Customers',
        description: 'Customers who made their first order in the last 45 days',
        rules: {
          operator: 'AND',
          conditions: [{ field: 'firstOrderAt', operator: 'orderedInLastDays', value: 45 }],
        },
        count: await prisma.customer.count({
          where: { firstOrderAt: { gte: subDays(now, 45) } },
        }),
      },
    }),
    prisma.segment.create({
      data: {
        name:        'VIP Whales',
        description: 'Top spenders: ₹25,000+ and 8+ orders',
        rules: {
          operator: 'AND',
          conditions: [
            { field: 'totalSpend',  operator: 'gte', value: 25000 },
            { field: 'orderCount', operator: 'gte', value: 8 },
          ],
        },
        count: await prisma.customer.count({
          where: { AND: [{ totalSpend: { gte: 25000 } }, { orderCount: { gte: 8 } }] },
        }),
      },
    }),
    prisma.segment.create({
      data: {
        name:        'One-Time Buyers',
        description: 'Customers who have placed exactly one order',
        rules: {
          operator: 'AND',
          conditions: [{ field: 'orderCount', operator: 'eq', value: 1 }],
        },
        count: await prisma.customer.count({ where: { orderCount: { equals: 1 } } }),
      },
    }),
  ])
  console.log(`✅ ${segments.length} segments inserted`)

  // ── 3 campaigns ───────────────────────────────────────────────────────────
  const [seg1, seg2] = segments

  // Campaign 1: Monsoon Madness Sale (sent, whatsapp)
  const campaign1 = await prisma.campaign.create({
    data: {
      name:            'Monsoon Madness Sale',
      segmentId:       seg1.id,
      channel:         'whatsapp',
      messageTemplate: 'Hey {{firstName}}! 🌧️ Our Monsoon Sale is LIVE — up to 40% off on kurtas, tops & more. Shop now and treat yourself! Use code MONSOON40. Happy shopping from Xeno Style 💜',
      status:          'sent',
      sentAt:          subDays(now, 3),
    },
  })

  // Generate 50 mock recipients for campaign 1
  const seg1Customers = await prisma.customer.findMany({
    where: { totalSpend: { gte: 10000 } },
    take: 50,
    select: { id: true },
  })

  const statuses1 = [
    ...Array(12).fill('clicked'),
    ...Array(16).fill('read'),
    ...Array(10).fill('opened'),
    ...Array(8).fill('delivered'),
    ...Array(4).fill('failed'),
  ]

  await prisma.campaignRecipient.createMany({
    data: seg1Customers.map((c, idx) => {
      const status = statuses1[idx] ?? 'delivered'
      const baseTime = subDays(now, 3)
      return {
        campaignId:  campaign1.id,
        customerId:  c.id,
        message:     campaign1.messageTemplate,
        status,
        sentAt:      baseTime,
        deliveredAt: ['delivered', 'opened', 'read', 'clicked'].includes(status)
          ? new Date(baseTime.getTime() + 2000) : null,
        openedAt:    ['opened', 'read', 'clicked'].includes(status)
          ? new Date(baseTime.getTime() + 8000) : null,
        readAt:      ['read', 'clicked'].includes(status)
          ? new Date(baseTime.getTime() + 12000) : null,
        clickedAt:   status === 'clicked'
          ? new Date(baseTime.getTime() + 14000) : null,
        failReason:  status === 'failed' ? 'User opted out' : null,
      }
    }),
  })

  // Campaign 2: Win Back (sent, sms)
  const campaign2 = await prisma.campaign.create({
    data: {
      name:            'Win Back 10% Off',
      segmentId:       seg2.id,
      channel:         'sms',
      messageTemplate: 'Hi {{firstName}}, we miss you! Get 10% off your next order. Code: COMEBACK10. Shop at xenostyle.in',
      status:          'sent',
      sentAt:          subDays(now, 7),
    },
  })

  const seg2Customers = await prisma.customer.findMany({
    where: { OR: [{ lastOrderAt: { lt: subDays(now, 60) } }, { lastOrderAt: null }] },
    take: 80,
    select: { id: true },
  })

  const statuses2 = [
    ...Array(18).fill('clicked'),
    ...Array(22).fill('read'),
    ...Array(14).fill('opened'),
    ...Array(18).fill('delivered'),
    ...Array(8).fill('failed'),
  ]

  await prisma.campaignRecipient.createMany({
    data: seg2Customers.map((c, idx) => {
      const status = statuses2[idx] ?? 'delivered'
      const baseTime = subDays(now, 7)
      return {
        campaignId:  campaign2.id,
        customerId:  c.id,
        message:     campaign2.messageTemplate,
        status,
        sentAt:      baseTime,
        deliveredAt: ['delivered', 'opened', 'read', 'clicked'].includes(status)
          ? new Date(baseTime.getTime() + 1500) : null,
        openedAt:    ['opened', 'read', 'clicked'].includes(status)
          ? new Date(baseTime.getTime() + 5000) : null,
        readAt:      ['read', 'clicked'].includes(status)
          ? new Date(baseTime.getTime() + 9000) : null,
        clickedAt:   status === 'clicked'
          ? new Date(baseTime.getTime() + 11000) : null,
        failReason:  status === 'failed' ? 'Invalid number' : null,
      }
    }),
  })

  // Campaign 3: Draft
  await prisma.campaign.create({
    data: {
      name:            'New Arrivals Drop',
      segmentId:       seg1.id,
      channel:         'whatsapp',
      messageTemplate: 'Hey {{firstName}}! ✨ Our new festive collection is here — handpicked styles just for our premium customers. Explore now at xenostyle.in',
      status:          'draft',
    },
  })

  console.log('✅ 3 campaigns + mock recipients inserted')
  console.log('\n🎉 Seed complete!')
  console.log(`   Customers: 500`)
  console.log(`   Orders:    ~${orderCount}`)
  console.log(`   Segments:  5`)
  console.log(`   Campaigns: 3 (2 sent, 1 draft)`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
