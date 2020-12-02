echo
echo "Enrolling a user..."
echo

ORG1_TOKEN=$(curl -s -X POST \
  http://localhost:4000/users \
  -H "content-type: application/x-www-form-urlencoded" \
  -d 'username=Tester&orgName=org1')
echo $ORG1_TOKEN
ORG1_TOKEN=$(echo $ORG1_TOKEN | jq ".token" | sed "s/\"//g")

echo 
echo "Invoking a transaction..."
echo

VALUE=$(curl -s -X POST \
  http://localhost:4000/channels/mychannel/chaincodes/fabcar \
  -H "authorization: Bearer $ORG1_TOKEN" \
  -H "content-type: application/json" \
  -d "{
  \"peers\": [\"peer0.org1.example.com:7051\",\"peer0.org2.example.com:9051\"],
  \"fcn\":\"CreateCar\",
  \"args\":[\"car123\",\"make\",\"model\",\"color\",\"owner\"]
}")

echo $VALUE
echo