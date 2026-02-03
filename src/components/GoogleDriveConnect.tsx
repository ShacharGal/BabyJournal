import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGoogleConnection, useInitiateGoogleAuth, useExchangeGoogleCode, useDisconnectGoogle } from "@/hooks/useGoogleDrive";
import { toast } from "@/hooks/use-toast";
import { Check, Cloud, CloudOff, Loader2, ExternalLink } from "lucide-react";

export function GoogleDriveConnect() {
  const { data: connection, isLoading } = useGoogleConnection();
  const initiateAuth = useInitiateGoogleAuth();
  const exchangeCode = useExchangeGoogleCode();
  const disconnect = useDisconnectGoogle();
  const [isConnecting, setIsConnecting] = useState(false);

  const isConnected = !!connection?.refresh_token;

  // Handle OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    
    if (code && !isConnected) {
      setIsConnecting(true);
      exchangeCode.mutate(code, {
        onSuccess: () => {
          toast({
            title: "Google Drive Connected!",
            description: "Your Google Drive is now linked to Baby Journal.",
          });
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
          setIsConnecting(false);
        },
        onError: (error) => {
          toast({
            title: "Connection Failed",
            description: error.message,
            variant: "destructive",
          });
          window.history.replaceState({}, document.title, window.location.pathname);
          setIsConnecting(false);
        },
      });
    }
  }, []);

  const handleConnect = async () => {
    try {
      const { url } = await initiateAuth.mutateAsync();
      window.location.href = url;
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to initiate Google auth",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = () => {
    disconnect.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: "Disconnected",
          description: "Google Drive has been unlinked.",
        });
      },
    });
  };

  if (isLoading || isConnecting) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Google Drive
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5" />
          Google Drive
          {isConnected && (
            <Badge variant="secondary" className="ml-auto">
              <Check className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {isConnected 
            ? "Your media is being stored in Google Drive" 
            : "Connect your Google Drive to store photos and videos"
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isConnected ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Files are saved to the BabyJournal folder
            </p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnect.isPending}
            >
              {disconnect.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CloudOff className="h-4 w-4 mr-2" />
                  Disconnect
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Before connecting, make sure you have:
            </p>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>Created a Google Cloud project</li>
              <li>Enabled the Google Drive API</li>
              <li>Set up OAuth credentials</li>
              <li>Added your client ID and secret to the backend</li>
            </ol>
            <Button 
              onClick={handleConnect}
              disabled={initiateAuth.isPending}
              className="w-full"
            >
              {initiateAuth.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Connect Google Drive
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
