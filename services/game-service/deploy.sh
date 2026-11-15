#!/bin/sh
# Run this ON THE VPS to pull the latest backend code, rebuild the image,
# and roll it out to the running k3s Deployment. Single-node setup: builds
# locally and imports straight into containerd (no external registry) -
# matches hero-details/accounts-service's deploy pattern.
set -e

REPO_DIR="$HOME/twogether"
IMAGE="twogether/game-service:latest"

echo "==> Pulling latest code"
cd "$REPO_DIR"
git pull

echo "==> Building image"
cd "$REPO_DIR/services/game-service"
docker build -t "$IMAGE" .

echo "==> Importing image into k3s containerd"
docker save "$IMAGE" | sudo k3s ctr images import -

echo "==> Applying k8s manifests (picks up any env var/resource/etc changes -
     without this, edits to deployment.yaml sit committed but never reach
     the live Deployment object, since rollout restart alone only re-reads
     whatever spec is already stored in the cluster)"
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

echo "==> Rolling out (imagePullPolicy: Never means the tag alone won't
     trigger a new pod - force a restart so it actually picks up the
     freshly-imported image)"
kubectl -n twogether rollout restart deployment/game-service
kubectl -n twogether rollout status deployment/game-service

echo "==> Health check"
kubectl -n twogether exec -it deploy/game-service -- wget -qO- http://localhost:8080/api/game/health
echo
echo "==> Done"
