#!/bin/bash
# Shanoir NG Kubernetes Deployment Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Shanoir NG Kubernetes Deployment${NC}"
echo "================================="

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}kubectl is not installed or not in PATH${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is not installed or not in PATH${NC}"
    exit 1
fi

# Test kubectl connection
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}Cannot connect to Kubernetes cluster${NC}"
    echo "Please check your kubectl configuration"
    exit 1
fi

echo -e "${GREEN}Prerequisites check passed${NC}"

# Build the project
echo -e "${YELLOW}Building CDK8s project...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed${NC}"
    exit 1
fi

# Check if namespace exists
if kubectl get namespace shanoir-ng &> /dev/null; then
    echo -e "${YELLOW}Namespace 'shanoir-ng' already exists${NC}"
    read -p "Do you want to continue? This will update existing resources (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled"
        exit 0
    fi
fi

# Apply manifests
echo -e "${YELLOW}Deploying to Kubernetes...${NC}"
kubectl apply -f dist/shanoir-ng.k8s.yaml

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Deployment successful!${NC}"
else
    echo -e "${RED}Deployment failed${NC}"
    exit 1
fi

# Wait for namespace to be ready
echo -e "${YELLOW}Waiting for namespace to be ready...${NC}"
kubectl wait --for=condition=Active namespace/shanoir-ng --timeout=60s

# Show status
echo -e "${YELLOW}Checking deployment status...${NC}"
echo
echo "Pods:"
kubectl get pods -n shanoir-ng

echo
echo "Services:"
kubectl get services -n shanoir-ng

echo
echo "PersistentVolumeClaims:"
kubectl get pvc -n shanoir-ng

echo
echo "Ingress:"
kubectl get ingress -n shanoir-ng

echo
echo -e "${GREEN}Deployment completed!${NC}"
echo
echo "To monitor the deployment:"
echo "  kubectl get pods -n shanoir-ng -w"
echo
echo "To check logs:"
echo "  kubectl logs -n shanoir-ng <pod-name>"
echo
echo "To access the application:"
echo "  kubectl get ingress -n shanoir-ng"
echo
echo "To delete the deployment:"
echo "  kubectl delete namespace shanoir-ng"