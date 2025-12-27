import { useNavigate } from 'react-router-dom'
import { ArrowRight, Database, FileSpreadsheet, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function HomePage() {
  const navigate = useNavigate()

  const handleGetStarted = () => {
    navigate('/jobs/new')
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4">
            ETL Portal
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Transform and load your data with ease. Connect CSV files or Google Sheets to your database in minutes.
          </p>
          <Button size="lg" onClick={handleGetStarted} className="text-lg px-8 py-6">
            Get Started
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card>
            <CardHeader>
              <FileSpreadsheet className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>Multiple Data Sources</CardTitle>
              <CardDescription>
                Upload CSV files or connect to Google Sheets for seamless data extraction
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Database className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>Database Loading</CardTitle>
              <CardDescription>
                Load data into PostgreSQL or Redshift with INSERT, UPSERT, or TRUNCATE strategies
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Zap className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>Automated Workflows</CardTitle>
              <CardDescription>
                Schedule recurring ETL jobs with cron expressions and monitor execution
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Quick Start Guide */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  1
                </span>
                <span>Select your data source - upload a CSV file or connect to Google Sheets</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  2
                </span>
                <span>Configure job details, load strategy, and database destination</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  3
                </span>
                <span>Map columns, apply transformations, and mark primary keys</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  4
                </span>
                <span>Set up a schedule (optional) and review your configuration</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  5
                </span>
                <span>Create your ETL job and start transforming data!</span>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
