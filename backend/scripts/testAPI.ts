import fetch from 'node-fetch'

async function testAPI() {
  try {
    const response = await fetch('http://localhost:5001/api/product-services?type=Service&category=Preventive%20Care')
    const data = await response.json()
    
    console.log('API Response:')
    console.log(JSON.stringify(data, null, 2))
  } catch (error) {
    console.error('Error:', error)
  }
}

testAPI()
