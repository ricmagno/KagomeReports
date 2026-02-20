#!/bin/bash

# Comprehensive instance management script
# Usage: ./manage-instances.sh <command> [arguments]

NAMESPACE="historian-reports"

show_help() {
    echo "Historian Reports Instance Manager"
    echo ""
    echo "Usage: $0 <command> [arguments]"
    echo ""
    echo "Commands:"
    echo "  deploy <name> <port>     Deploy new instance (port range: 30001-30010)"
    echo "  list                     List all instances"
    echo "  status <name>            Show status of specific instance"
    echo "  logs <name>              Show logs of specific instance"
    echo "  delete <name>            Delete specific instance"
    echo "  update <tag>             Update all instances to new image tag"
    echo "  scale <name> <replicas>  Scale instance (usually 1 for this app)"
    echo ""
    echo "Examples:"
    echo "  $0 deploy plant1 30001"
    echo "  $0 list"
    echo "  $0 status plant1"
    echo "  $0 logs plant1"
    echo "  $0 delete plant1"
    echo "  $0 update 0.78.0"
}

deploy_instance() {
    local name=$1
    local port=$2
    
    if [ -z "$name" ] || [ -z "$port" ]; then
        echo "Error: Instance name and port required"
        echo "Usage: $0 deploy <name> <port>"
        return 1
    fi
    
    if [ $port -lt 30001 ] || [ $port -gt 30010 ]; then
        echo "Error: Port must be between 30001-30010"
        return 1
    fi
    
    ./deploy-instance.sh "$name" "$port"
}

list_instances() {
    echo "Historian Reports Instances:"
    echo "============================"
    kubectl get deployments -n $NAMESPACE -o custom-columns="INSTANCE:.metadata.labels.instance,READY:.status.readyReplicas,AVAILABLE:.status.availableReplicas,AGE:.metadata.creationTimestamp" 2>/dev/null
    echo ""
    echo "Services:"
    kubectl get services -n $NAMESPACE -o custom-columns="INSTANCE:.metadata.labels.instance,TYPE:.spec.type,PORT:.spec.ports[0].nodePort,AGE:.metadata.creationTimestamp" 2>/dev/null
}

show_status() {
    local name=$1
    if [ -z "$name" ]; then
        echo "Error: Instance name required"
        return 1
    fi
    
    echo "Status for instance: $name"
    echo "========================"
    kubectl get pods -n $NAMESPACE -l instance=$name
    echo ""
    kubectl describe deployment historian-reports-$name -n $NAMESPACE
}

show_logs() {
    local name=$1
    if [ -z "$name" ]; then
        echo "Error: Instance name required"
        return 1
    fi
    
    echo "Logs for instance: $name"
    echo "======================="
    kubectl logs -n $NAMESPACE -l instance=$name --tail=50 -f
}

delete_instance() {
    local name=$1
    if [ -z "$name" ]; then
        echo "Error: Instance name required"
        return 1
    fi
    
    echo "Deleting instance: $name"
    kubectl delete deployment historian-reports-$name -n $NAMESPACE
    kubectl delete service historian-reports-$name -n $NAMESPACE
    
    # Clean up generated files
    rm -f k8s-manifests/deployment-$name.yaml
    rm -f k8s-manifests/service-$name.yaml
    
    echo "Instance $name deleted successfully"
}

update_instances() {
    local tag=$1
    if [ -z "$tag" ]; then
        echo "Error: Image tag required"
        return 1
    fi
    
    ./update-all-instances.sh "$tag"
}

scale_instance() {
    local name=$1
    local replicas=$2
    
    if [ -z "$name" ] || [ -z "$replicas" ]; then
        echo "Error: Instance name and replica count required"
        return 1
    fi
    
    kubectl scale deployment historian-reports-$name --replicas=$replicas -n $NAMESPACE
    echo "Scaled instance $name to $replicas replicas"
}

# Main command processing
case "$1" in
    deploy)
        deploy_instance "$2" "$3"
        ;;
    list)
        list_instances
        ;;
    status)
        show_status "$2"
        ;;
    logs)
        show_logs "$2"
        ;;
    delete)
        delete_instance "$2"
        ;;
    update)
        update_instances "$2"
        ;;
    scale)
        scale_instance "$2" "$3"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "Error: Unknown command '$1'"
        echo ""
        show_help
        exit 1
        ;;
esac