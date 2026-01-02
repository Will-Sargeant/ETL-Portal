import { LocalLogin } from './LocalLogin'
import { GoogleLogin } from './GoogleLogin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">ETL Portal</CardTitle>
          <CardDescription>Sign in to access your account</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="local" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="local">Email</TabsTrigger>
              <TabsTrigger value="google">
                Google
              </TabsTrigger>
              <TabsTrigger value="saml" disabled>
                SAML
              </TabsTrigger>
            </TabsList>
            <TabsContent value="local" className="mt-6">
              <LocalLogin />
            </TabsContent>
            <TabsContent value="google" className="mt-6">
              <GoogleLogin />
            </TabsContent>
            <TabsContent value="saml" className="mt-6">
              <div className="p-8 text-center text-muted-foreground">
                SAML (Okta) integration available.
                <br />
                Contact your administrator to enable.
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
