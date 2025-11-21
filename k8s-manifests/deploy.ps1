# Shanoir NG Kubernetes Deployment Script (PowerShell)

param(
    [switch]$Force,
    [switch]$DryRun
)

# Function to write colored output
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    } else {
        $input | Write-Output
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Green {
    param([string]$Text)
    Write-ColorOutput Green $Text
}

function Write-Yellow {
    param([string]$Text)
    Write-ColorOutput Yellow $Text
}

function Write-Red {
    param([string]$Text)
    Write-ColorOutput Red $Text
}

Write-Green "Shanoir NG Kubernetes Deployment"
Write-Output "================================="

# Check prerequisites
Write-Yellow "Checking prerequisites..."

# Check kubectl
try {
    kubectl version --client=true *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "kubectl not found"
    }
} catch {
    Write-Red "kubectl is not installed or not in PATH"
    exit 1
}

# Check npm
try {
    npm --version *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "npm not found"
    }
} catch {
    Write-Red "npm is not installed or not in PATH"
    exit 1
}

# Test kubectl connection
try {
    kubectl cluster-info *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "kubectl connection failed"
    }
} catch {
    Write-Red "Cannot connect to Kubernetes cluster"
    Write-Output "Please check your kubectl configuration"
    exit 1
}

Write-Green "Prerequisites check passed"

# Build the project
Write-Yellow "Building CDK8s project..."
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Red "Build failed"
    exit 1
}

# Check if namespace exists
$namespaceExists = $false
try {
    kubectl get namespace shanoir-ng *> $null
    $namespaceExists = ($LASTEXITCODE -eq 0)
} catch {
    $namespaceExists = $false
}

if ($namespaceExists -and -not $Force) {
    Write-Yellow "Namespace 'shanoir-ng' already exists"
    $response = Read-Host "Do you want to continue? This will update existing resources (y/N)"
    if ($response -notmatch '^[Yy]$') {
        Write-Output "Deployment cancelled"
        exit 0
    }
}

# Apply manifests
if ($DryRun) {
    Write-Yellow "Dry run mode - showing what would be applied:"
    kubectl apply -f dist/shanoir-ng.k8s.yaml --dry-run=client
} else {
    Write-Yellow "Deploying to Kubernetes..."
    kubectl apply -f dist/shanoir-ng.k8s.yaml

    if ($LASTEXITCODE -ne 0) {
        Write-Red "Deployment failed"
        exit 1
    }

    Write-Green "Deployment successful!"

    # Wait for namespace to be ready
    Write-Yellow "Waiting for namespace to be ready..."
    kubectl wait --for=condition=Active namespace/shanoir-ng --timeout=60s

    # Show status
    Write-Yellow "Checking deployment status..."
    Write-Output ""
    Write-Output "Pods:"
    kubectl get pods -n shanoir-ng

    Write-Output ""
    Write-Output "Services:"
    kubectl get services -n shanoir-ng

    Write-Output ""
    Write-Output "PersistentVolumeClaims:"
    kubectl get pvc -n shanoir-ng

    Write-Output ""
    Write-Output "Ingress:"
    kubectl get ingress -n shanoir-ng

    Write-Output ""
    Write-Green "Deployment completed!"
    Write-Output ""
    Write-Output "To monitor the deployment:"
    Write-Output "  kubectl get pods -n shanoir-ng -w"
    Write-Output ""
    Write-Output "To check logs:"
    Write-Output "  kubectl logs -n shanoir-ng <pod-name>"
    Write-Output ""
    Write-Output "To access the application:"
    Write-Output "  kubectl get ingress -n shanoir-ng"
    Write-Output ""
    Write-Output "To delete the deployment:"
    Write-Output "  kubectl delete namespace shanoir-ng"
}